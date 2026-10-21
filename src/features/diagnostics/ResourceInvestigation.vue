<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { InvestigationSnapshot, OwnedKey, ResourceOperation } from './resource-investigation'
import { measurement } from './presentation'
const props = defineProps<{ snapshot: InvestigationSnapshot }>()
const selected = defineModel<'Cleanup' | 'Caches' | 'Requests' | 'Storage'>('selected', {
  default: 'Cleanup',
})
defineEmits<{ mark: []; clear: []; storage: [] }>()
const categories = ['Cleanup', 'Caches', 'Requests', 'Storage'] as const
const navigation = ref<HTMLElement>()
const names: Record<OwnedKey, string> = {
  viewers: 'Readers',
  pdfWorkerOwners: 'PDF task owners',
  canvases: 'Canvas buffers',
  previewEntries: 'Preview entries',
  previewBytes: 'Preview pixel estimate',
  dimensionEntries: 'Dimension entries',
  blobURLs: 'Blob URLs',
  blobBytes: 'Blob payload',
  canvasBytes: 'Canvas RGBA',
}
const operations: Record<ResourceOperation, string> = {
  'pdf.render-request': 'PDF render request',
  'pdf.release': 'PDF teardown',
  'reading.transaction': 'Reading metadata transaction',
  'workspace.transaction': 'Workspace transaction',
}
const primary = computed(() =>
  props.snapshot.comparison.filter((row) =>
    ['viewers', 'pdfWorkerOwners', 'canvases', 'blobURLs'].includes(row.key),
  ),
)
const remaining = computed(() =>
  props.snapshot.comparison.filter((row) => !primary.value.includes(row)),
)
const matches = computed(() => primary.value.every((row) => row.delta === 0))
const latestRender = computed(() =>
  props.snapshot.timings
    .slice()
    .reverse()
    .find((row) => row.operation === 'pdf.render-request'),
)
const pending = computed(() =>
  props.snapshot.pending.reduce((groups, row) => {
    const group = groups.get(row.operation) ?? { operation: row.operation, count: 0, oldest: 0 }
    group.count++
    group.oldest = Math.max(group.oldest, row.ageMs)
    groups.set(row.operation, group)
    return groups
  }, new Map<ResourceOperation, { operation: ResourceOperation; count: number; oldest: number }>()),
)
const current = (key: OwnedKey) => props.snapshot.comparison.find((row) => row.key === key)!.current
const bytes = (value: number | null) => measurement(value === null ? null : value / 1048576, 'MiB')
function display(value: number | null, key: OwnedKey) {
  return value === null ? 'Not marked' : key.endsWith('Bytes') ? bytes(value) : String(value)
}
function delta(value: number | null, key: OwnedKey) {
  return value === null
    ? 'Not marked'
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${display(Math.abs(value), key)}`
}
function stages(operation: ResourceOperation) {
  return operation.endsWith('transaction')
    ? ['Connection', 'Transaction']
    : operation === 'pdf.release'
      ? ['Preparation', 'Teardown']
      : ['Before processing', 'Processing']
}
async function navigate(event: KeyboardEvent) {
  const index = categories.indexOf(selected.value)
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? 3
        : event.key === 'ArrowRight'
          ? (index + 1) % 4
          : event.key === 'ArrowLeft'
            ? (index + 3) % 4
            : null
  if (target === null) return
  event.preventDefault()
  selected.value = categories[target]!
  await nextTick()
  navigation.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
}
</script>
<template>
  <section class="resource-investigation" aria-label="Resource investigation">
    <div
      ref="navigation"
      class="categories"
      role="tablist"
      aria-label="Resource categories"
      @keydown="navigate"
    >
      <button
        v-for="category in categories"
        :id="`resource-tab-${category}`"
        :key="category"
        class="pt-plain-control"
        type="button"
        role="tab"
        :aria-selected="selected === category"
        :aria-controls="`resource-panel-${category}`"
        :tabindex="selected === category ? 0 : -1"
        @click="selected = category"
      >
        {{ category }}
      </button>
    </div>
    <section
      :id="`resource-panel-${selected}`"
      role="tabpanel"
      :aria-labelledby="`resource-tab-${selected}`"
      tabindex="0"
    >
      <template v-if="selected === 'Cleanup'">
        <div class="heading">
          <div>
            <h3>What remains after closing?</h3>
            <p class="muted">
              {{
                snapshot.baseline
                  ? 'Baseline marked · compare after cleanup settles'
                  : 'No baseline marked yet'
              }}
            </p>
          </div>
          <div class="controls">
            <button class="pt-plain-control" type="button" @click="$emit('mark')">
              Mark baseline</button
            ><button
              class="pt-plain-control"
              type="button"
              :disabled="!snapshot.baseline"
              @click="$emit('clear')"
            >
              Clear
            </button>
          </div>
        </div>
        <div class="explanation">
          <strong>{{
            !snapshot.baseline
              ? 'Mark a starting point first'
              : matches
                ? 'Selected owner counts match the baseline'
                : 'Tracked owner counts differ from the baseline'
          }}</strong>
          <p>
            {{
              !snapshot.baseline
                ? 'Capture a baseline before opening documents, then compare after closing them.'
                : matches
                  ? 'Heap estimates can remain higher. Matching counts alone do not establish that all memory was released.'
                  : 'Readers may be active or retained while inactive. Close documents and allow cleanup to settle before comparing.'
            }}
          </p>
        </div>
        <div class="metrics">
          <div>
            <span>Tracked readers</span><strong>{{ current('viewers') }}</strong
            ><small
              >{{ delta(primary.find((row) => row.key === 'viewers')!.delta, 'viewers') }} · vs
              baseline</small
            >
          </div>
          <div>
            <span>Canvas estimate</span><strong>{{ bytes(current('canvasBytes')) }}</strong
            ><small>RGBA pixels only</small>
          </div>
          <div>
            <span>JS heap</span><strong>{{ bytes(snapshot.heap.currentBytes) }}</strong
            ><small>{{
              snapshot.heap.deltaBytes === null
                ? 'Comparison unavailable'
                : delta(snapshot.heap.deltaBytes, 'canvasBytes') + ' · vs baseline'
            }}</small>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <caption>
              Instrumented ownership · zero means no tracked ownership
            </caption>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Before</th>
                <th>Now</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in primary" :key="row.key">
                <th scope="row">
                  {{ names[row.key] }}<small>{{ row.registration }}</small>
                </th>
                <td>{{ display(row.baseline, row.key) }}</td>
                <td>{{ display(row.current, row.key) }}</td>
                <td>{{ delta(row.delta, row.key) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <details>
          <summary>Byte estimates and remaining owned counts</summary>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Before</th>
                  <th>Now</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in remaining" :key="row.key">
                  <th scope="row">
                    {{ names[row.key] }}<small>{{ row.registration }}</small>
                  </th>
                  <td>{{ display(row.baseline, row.key) }}</td>
                  <td>{{ display(row.current, row.key) }}</td>
                  <td>{{ delta(row.delta, row.key) }}</td>
                </tr>
                <tr>
                  <th scope="row">JS heap</th>
                  <td>{{ bytes(snapshot.heap.baselineBytes) }}</td>
                  <td>{{ bytes(snapshot.heap.currentBytes) }}</td>
                  <td>
                    {{
                      snapshot.heap.deltaBytes === null
                        ? 'Unavailable'
                        : delta(snapshot.heap.deltaBytes, 'canvasBytes')
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        <details>
          <summary>How to read this / captured evidence</summary>
          <p>
            Mark a baseline → open and switch documents → close them → wait → compare. Inactive
            readers may remain for five minutes. A baseline marked with documents open includes
            their owners.
          </p>
          <p>{{ snapshot.scope.owned }}</p>
          <p>{{ snapshot.scope.cleanup }}</p>
          <p>
            PDF task owners are not actual worker-thread counts. Registered zero and no registered
            owner describe different coverage. JS heap comes from nonstandard performance.memory
            where supported; it is not process or GPU memory. Do not add heap, canvas, Blob and
            preview estimates: they overlap. Preview pixel estimates are a subset of tracked canvas
            estimates.
          </p>
        </details>
      </template>
      <template v-else-if="selected === 'Caches'">
        <h3>Is cached PDF work being reused?</h3>
        <p class="muted">Recorded lookups since session start/reset, while sampling</p>
        <div class="metrics">
          <div>
            <span>Preview hits</span><strong>{{ snapshot.caches.preview.hits }}</strong
            ><small>Reused cached work</small>
          </div>
          <div>
            <span>Preview misses</span><strong>{{ snapshot.caches.preview.misses }}</strong
            ><small>Work requested again</small>
          </div>
          <div>
            <span>Capacity evictions</span><strong>{{ snapshot.caches.preview.evictions }}</strong
            ><small>Preview cache limit reached</small>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cache</th>
                <th>Hits</th>
                <th>Misses</th>
                <th>Evicted</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, key) in snapshot.caches" :key="key">
                <th scope="row">{{ key === 'preview' ? 'Page previews' : 'Page dimensions' }}</th>
                <td>{{ row.hits }}</td>
                <td>{{ row.misses }}</td>
                <td>{{ row.evictions }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="explanation">
          <strong>A miss can be normal on a first visit</strong>
          <p>
            A hit means cached work was reused. A capacity eviction makes room for another entry; it
            is not a failed request.
          </p>
        </div>
        <details>
          <summary>How to read this / captured evidence</summary>
          <p>{{ snapshot.scope.caches }}</p>
          <p>
            Current occupancy: {{ current('previewEntries') }} preview entries and
            {{ current('dimensionEntries') }} dimension entries. Occupancy counts differ from lookup
            counters. The preview cache holds up to 128 entries. Closing a reader is not a capacity
            eviction. These counters alone do not establish overall performance.
          </p>
        </details>
      </template>
      <template v-else-if="selected === 'Requests'">
        <h3>Where is the request taking time?</h3>
        <p class="muted">Retained request timings · milliseconds</p>
        <div class="metrics">
          <div>
            <span>Pending now</span><strong>{{ snapshot.pending.length }}</strong
            ><small>Recorded in-flight work</small>
          </div>
          <div>
            <span>Retained</span><strong>{{ snapshot.timings.length }}</strong
            ><small>Includes failed and cancelled</small>
          </div>
          <div>
            <span>Record limit</span><strong>120</strong><small>Bounded timing history</small>
          </div>
        </div>
        <div v-if="latestRender" class="explanation">
          <strong>Latest PDF render request · {{ measurement(latestRender.durationMs) }}</strong>
          <div v-for="(label, index) in stages('pdf.render-request')" :key="label" class="stage">
            <div>
              <span>{{ label }}</span
              ><span>{{
                measurement(index === 0 ? latestRender.waitMs : latestRender.processingMs)
              }}</span>
            </div>
            <div class="track">
              <div
                :style="{
                  width: `${latestRender.durationMs > 0 ? Math.min(100, ((index === 0 ? (latestRender.waitMs ?? 0) : (latestRender.processingMs ?? 0)) / latestRender.durationMs) * 100) : 0}%`,
                }"
              />
            </div>
          </div>
          <p class="muted">Application stages, not worker CPU time or internal worker queues.</p>
        </div>
        <p v-if="!snapshot.pending.length" class="muted">No recorded pending requests.</p>
        <ul v-else>
          <li v-for="row in [...pending.values()]" :key="row.operation">
            {{ operations[row.operation] }} · {{ row.count }} pending · oldest
            {{ measurement(row.oldest) }}
          </li>
        </ul>
        <p v-if="!snapshot.timings.length" class="explanation">No retained request timings yet.</p>
        <ol v-else class="requests" aria-label="Latest retained requests">
          <li v-for="(row, index) in snapshot.timings.slice(-12).reverse()" :key="index">
            <div class="request-heading">
              <strong>{{ operations[row.operation] }}</strong
              ><span
                >{{ measurement(row.durationMs) }} · {{ row.outcome
                }}{{ row.failure ? ' · ' + row.failure : '' }}</span
              >
            </div>
            <p class="muted">
              {{ stages(row.operation)[0] }} {{ measurement(row.waitMs) }} ·
              {{ stages(row.operation)[1] }} {{ measurement(row.processingMs) }}
            </p>
          </li>
        </ol>
        <details>
          <summary>How to read this / captured evidence</summary>
          <p>{{ snapshot.scope.timings }}</p>
          <p>
            Showing the latest 12 retained records. {{ snapshot.dropped }} requests skipped by the
            recording limit. Pending age measures elapsed time so far, not a completed duration.
            Unavailable stages are not zero. Connection and transaction stages are application
            boundaries; transaction completion records commit rather than a staged result. Fixed
            failure categories omit private error details.
          </p>
          <ul>
            <li
              v-for="operation in Object.keys(operations) as ResourceOperation[]"
              :key="operation"
            >
              {{ operations[operation] }}: <code>{{ operation }}</code>
            </li>
          </ul>
        </details>
      </template>
      <template v-else>
        <div class="heading">
          <div>
            <h3>How much origin storage is used?</h3>
            <p class="muted">Browser origin estimate · disk usage, not memory</p>
          </div>
          <button
            class="pt-plain-control"
            type="button"
            :disabled="!snapshot.active || snapshot.storage.status === 'Sampling'"
            @click="$emit('storage')"
          >
            Refresh estimate
          </button>
        </div>
        <div class="metrics">
          <div>
            <span>Usage</span><strong>{{ bytes(snapshot.storage.usageBytes) }}</strong
            ><small>Origin disk estimate</small>
          </div>
          <div>
            <span>Quota</span><strong>{{ bytes(snapshot.storage.quotaBytes) }}</strong
            ><small>Browser-reported allowance</small>
          </div>
          <div><span>Source</span><strong>Storage API</strong><small>Manual estimate</small></div>
        </div>
        <div class="explanation">
          <strong>{{
            snapshot.storage.observedAtMs !== null
              ? 'Estimate captured'
              : 'Refresh only when needed'
          }}</strong>
          <p role="status">{{ snapshot.storage.status }}</p>
        </div>
        <details>
          <summary>How to read this / captured evidence</summary>
          <p>
            Refresh requests an estimate only when selected; it does not request storage
            permissions. Usage and quota cover this origin, potentially including other deployment
            channels on the same origin. They are not document size, RAM, or a per-document
            allocation.
          </p>
          <p>{{ snapshot.scope.pageMemory }}</p>
          <p>{{ snapshot.scope.untracked }}</p>
          <p>
            CPU/GPU/process memory requires external profiling in #16. Optional page-memory
            capability does not mean that a measurement has been captured.
          </p>
        </details>
      </template>
    </section>
    <p class="scope-note">Instrumented application data · No automatic memory-leak verdict</p>
  </section>
</template>
<style scoped>
.resource-investigation {
  margin-top: 14px;
  min-width: 0;
}
.categories {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  margin-bottom: 20px;
  background: var(--pt-canvas);
  border: 1px solid var(--pt-line);
  border-radius: 9px;
}
button {
  border: 1px solid var(--pt-line);
  border-radius: 6px;
  padding: 7px 10px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  font-size: 12px;
}
.categories button {
  background: transparent;
  border-color: transparent;
}
.categories button[aria-selected='true'] {
  background: var(--pt-panel);
  border-color: var(--pt-line);
  font-weight: 600;
}
button:disabled {
  opacity: 0.55;
}
button:focus-visible,
summary:focus-visible,
[role='tabpanel']:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
}
p,
li {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.muted,
small,
caption,
.scope-note {
  color: var(--pt-muted);
  font-size: 12px;
}
.heading,
.controls {
  display: flex;
  align-items: start;
  gap: 8px;
  flex-wrap: wrap;
}
.heading {
  justify-content: space-between;
}
.heading > div:first-child {
  flex: 1 1 230px;
}
.explanation {
  background: var(--pt-canvas);
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  padding: 12px;
  margin: 14px 0;
  font-size: 12px;
}
.explanation p:last-child {
  margin-bottom: 0;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 16px 0;
  border: 1px solid var(--pt-line);
  border-radius: 8px;
}
.metrics > div {
  padding: 12px 10px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.metrics > div + div {
  border-left: 1px solid var(--pt-line);
}
.metrics span,
small {
  display: block;
}
.metrics span {
  color: var(--pt-muted);
  font-size: 12px;
}
.metrics strong {
  display: block;
  font-size: 19px;
  margin: 5px 0;
  font-variant-numeric: tabular-nums;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
caption {
  text-align: left;
  margin: 8px 0;
}
th,
td {
  padding: 9px 5px;
  border-bottom: 1px solid var(--pt-line);
  text-align: right;
  vertical-align: top;
}
th:first-child {
  text-align: left;
}
th {
  font-weight: 500;
}
details {
  border-top: 1px solid var(--pt-line);
  padding-top: 12px;
  margin-top: 14px;
  font-size: 12px;
}
summary {
  cursor: pointer;
  font-weight: 500;
}
.scope-note {
  border-top: 1px solid var(--pt-line);
  margin-top: 18px;
  padding-top: 12px;
}
.requests {
  padding: 0;
  list-style: none;
}
.requests li {
  padding: 10px 0;
  border-bottom: 1px solid var(--pt-line);
}
.request-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}
.stage {
  margin-top: 12px;
}
.stage > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.track {
  height: 6px;
  border-radius: 4px;
  background: var(--pt-line);
  margin-top: 6px;
  overflow: hidden;
}
.track > div {
  height: 100%;
  background: var(--pt-brand);
}
@media (max-width: 440px) {
  .categories {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metrics strong {
    font-size: 16px;
  }
  .metrics > div {
    padding: 10px 6px;
  }
}
@media (pointer: coarse) {
  button,
  summary {
    min-height: 44px;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { InvestigationSnapshot, OwnedKey } from './resource-investigation'
import { measurement } from './presentation'
const props = defineProps<{ snapshot: InvestigationSnapshot }>()
defineEmits<{ mark: []; clear: []; storage: [] }>()
const names: Record<OwnedKey, string> = {
  viewers: 'Mounted readers',
  pdfWorkerOwners: 'PDF worker owners',
  canvases: 'Owned canvases',
  previewEntries: 'Preview entries',
  previewBytes: 'Preview pixel estimate',
  dimensionEntries: 'Dimension entries',
  blobURLs: 'Owned Blob URLs',
  blobBytes: 'Owned Blob payload bytes',
  canvasBytes: 'Canvas RGBA estimate',
}
const pending = computed(() =>
  props.snapshot.pending.reduce((groups, row) => {
    const group = groups.get(row.operation) ?? { operation: row.operation, count: 0, oldest: 0 }
    group.count++
    group.oldest = Math.max(group.oldest, row.ageMs)
    groups.set(row.operation, group)
    return groups
  }, new Map<string, { operation: string; count: number; oldest: number }>()),
)
function display(value: number | null, key: OwnedKey) {
  return value === null
    ? 'Not marked'
    : key.endsWith('Bytes')
      ? measurement(value / 1048576, 'MiB')
      : String(value)
}
function delta(value: number | null, key: OwnedKey) {
  if (value === null) return 'Not marked'
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${display(Math.abs(value), key)}`
}
</script>
<template>
  <section class="resource-investigation" aria-label="Resource investigation">
    <h3>Cleanup baseline</h3>
    <div class="controls">
      <button type="button" class="pt-plain-control" @click="$emit('mark')">Mark baseline</button>
      <button
        type="button"
        class="pt-plain-control"
        :disabled="!snapshot.baseline"
        @click="$emit('clear')"
      >
        Clear baseline
      </button>
    </div>
    <p>
      {{
        snapshot.baseline
          ? 'Comparing current owned resources with the marked baseline.'
          : 'Mark before opening documents, then compare after switching and closing them.'
      }}
    </p>
    <p class="muted">
      Expected inactive readers may remain for five minutes. Wait for asynchronous cleanup to
      settle. Positive deltas are investigation hints, not proof of a leak.
    </p>
    <div class="table-wrap">
      <table>
        <caption>
          Instrumented ownership · zero means no tracked ownership
        </caption>
        <thead>
          <tr>
            <th scope="col">Resource</th>
            <th scope="col">Current</th>
            <th scope="col">Baseline</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in snapshot.comparison" :key="row.key">
            <th scope="row">
              {{ names[row.key] }}<small>{{ row.registration }}</small>
            </th>
            <td>{{ display(row.current, row.key) }}</td>
            <td>{{ display(row.baseline, row.key) }}</td>
            <td>{{ delta(row.delta, row.key) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted">{{ snapshot.scope.owned }}</p>
    <h3>JS heap comparison</h3>
    <dl class="values">
      <dt>Current</dt>
      <dd>
        {{
          measurement(
            snapshot.heap.currentBytes === null ? null : snapshot.heap.currentBytes / 1048576,
            'MiB',
          )
        }}
      </dd>
      <dt>Baseline</dt>
      <dd>
        {{
          measurement(
            snapshot.heap.baselineBytes === null ? null : snapshot.heap.baselineBytes / 1048576,
            'MiB',
          )
        }}
      </dd>
      <dt>Change</dt>
      <dd>
        {{
          snapshot.heap.deltaBytes === null
            ? 'Unavailable'
            : `${snapshot.heap.deltaBytes > 0 ? '+' : snapshot.heap.deltaBytes < 0 ? '−' : ''}${measurement(Math.abs(snapshot.heap.deltaBytes) / 1048576, 'MiB')}`
        }}
      </dd>
    </dl>
    <p class="muted">
      Source: nonstandard performance.memory.usedJSHeapSize where supported. JS heap is not browser
      process/GPU memory. A change does not establish a leak.
    </p>
    <h3>PDF cache activity</h3>
    <div class="table-wrap">
      <table>
        <caption>
          Recorded since session start/reset, while sampling
        </caption>
        <thead>
          <tr>
            <th scope="col">Cache</th>
            <th scope="col">Hits</th>
            <th scope="col">Misses</th>
            <th scope="col">Capacity evictions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, key) in snapshot.caches" :key="key">
            <th scope="row">{{ key }}</th>
            <td>{{ row.hits }}</td>
            <td>{{ row.misses }}</td>
            <td>{{ row.evictions }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3>Requests and persistence</h3>
    <p v-if="!snapshot.pending.length">No recorded pending requests.</p>
    <ul v-else>
      <li v-for="row in [...pending.values()]" :key="row.operation">
        {{ row.operation }} · {{ row.count }} pending · oldest {{ measurement(row.oldest) }}
      </li>
    </ul>
    <p v-if="!snapshot.timings.length">No retained request timings yet.</p>
    <div v-else class="table-wrap">
      <table>
        <caption>
          Latest retained request timings (ms; maximum120)
        </caption>
        <thead>
          <tr>
            <th scope="col">Operation</th>
            <th scope="col">Wait</th>
            <th scope="col">Processing</th>
            <th scope="col">Total</th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in snapshot.timings.slice(-12).reverse()" :key="index">
            <th scope="row">{{ row.operation }}</th>
            <td>{{ measurement(row.waitMs) }}</td>
            <td>{{ measurement(row.processingMs) }}</td>
            <td>{{ measurement(row.durationMs) }}</td>
            <td>
              {{ row.outcome }}<small v-if="row.failure">{{ row.failure }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted">
      {{ snapshot.scope.timings }} · {{ snapshot.dropped }} requests skipped by the recording limit.
    </p>
    <h3>Origin storage estimate</h3>
    <button
      type="button"
      class="pt-plain-control"
      :disabled="!snapshot.active || snapshot.storage.status === 'Sampling'"
      @click="$emit('storage')"
    >
      Refresh storage estimate
    </button>
    <p role="status">{{ snapshot.storage.status }}</p>
    <dl class="values">
      <dt>Usage</dt>
      <dd>
        {{
          measurement(
            snapshot.storage.usageBytes === null ? null : snapshot.storage.usageBytes / 1048576,
            'MiB',
          )
        }}
      </dd>
      <dt>Quota</dt>
      <dd>
        {{
          measurement(
            snapshot.storage.quotaBytes === null ? null : snapshot.storage.quotaBytes / 1048576,
            'MiB',
          )
        }}
      </dd>
    </dl>
    <details>
      <summary>Scope and unavailable measurements</summary>
      <p>{{ snapshot.scope.untracked }}</p>
      <p>{{ snapshot.scope.pageMemory }}</p>
      <p>
        CPU/GPU/process memory requires external profiling in #16. Storage is origin disk usage, not
        RAM or a per-document/release allocation. Owner counts are instrumented totals, not actual
        worker-thread counts. Completed requests and baseline evidence are included in private JSON.
      </p>
    </details>
  </section>
</template>
<style scoped>
.resource-investigation {
  margin-top: 14px;
  min-width: 0;
}
h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 8px;
}
p,
li {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.muted,
small,
caption {
  color: var(--pt-muted);
  font-size: 12px;
}
.controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
button {
  border: 1px solid var(--pt-line);
  border-radius: 6px;
  padding: 7px 10px;
  background: var(--pt-panel);
  color: var(--pt-ink);
}
button:disabled {
  opacity: 0.55;
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
  padding: 8px 5px;
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
small {
  display: block;
}
.values {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
details {
  border-top: 1px solid var(--pt-line);
  padding-top: 12px;
  margin-top: 16px;
}
@media (pointer: coarse) {
  button,
  summary {
    min-height: 44px;
  }
}
</style>

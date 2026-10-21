<script setup lang="ts">
import { computed, ref } from 'vue'
import DiagnosticTrend from './DiagnosticTrend.vue'
import { measurement, metricNames, operationStats, type Snapshot } from './presentation'
const props = defineProps<{ snapshot: Snapshot; capabilities: Record<string, string> }>()
const tabs = ['Overview', 'Operations', 'Resources', 'Timeline'] as const
const active = ref<(typeof tabs)[number]>('Overview')
const stats = computed(() => operationStats(props.snapshot.timings))
const latest = computed(() => props.snapshot.samples.at(-1))
const resources = [
  ['viewers', 'Mounted readers', 'Includes retained inactive readers; not only the focused tab.'],
  [
    'pdfWorkerOwners',
    'PDF worker owners',
    'Loading-task owners; shared/fake workers mean this is not a thread count.',
  ],
  ['canvases', 'Page canvases', 'Application-owned mounted PDF canvases.'],
  ['previewEntries', 'Preview cache entries', 'Tracked application preview entries.'],
  [
    'previewBytes',
    'Preview pixel estimate',
    'RGBA pixel estimate; excludes overhead and is not process or GPU memory.',
  ],
  ['dimensionEntries', 'Page dimension entries', 'Tracked cached page dimensions.'],
  ['blobURLs', 'Owned Blob URLs', 'Tracked object URLs; not browser-wide totals or byte sizes.'],
] as const
function selectTab(event: KeyboardEvent, index: number) {
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft'
            ? (index + tabs.length - 1) % tabs.length
            : null
  if (next === null) return
  event.preventDefault()
  active.value = tabs[next]!
  const list = (event.currentTarget as HTMLElement).parentElement
  ;(list?.querySelectorAll('button')[next] as HTMLButtonElement)?.focus()
}
</script>
<template>
  <p class="scope">
    {{ snapshot.running ? 'Recording' : 'Paused · retained readings' }} · Targets not configured
  </p>
  <div role="tablist" aria-label="Diagnostic views" class="tabs">
    <button
      v-for="(tab, index) in tabs"
      :id="`diagnostic-tab-${tab}`"
      :key="tab"
      type="button"
      role="tab"
      :aria-selected="active === tab"
      :aria-controls="`diagnostic-view-${tab}`"
      :tabindex="active === tab ? 0 : -1"
      @click="active = tab"
      @keydown="selectTab($event, index)"
    >
      {{ tab }}
    </button>
  </div>
  <div
    v-for="tab in tabs"
    v-show="active === tab"
    :id="`diagnostic-view-${tab}`"
    :key="tab"
    role="tabpanel"
    :aria-labelledby="`diagnostic-tab-${tab}`"
    :hidden="active !== tab"
  >
    <template v-if="tab === 'Overview'">
      <p>
        No health verdict yet. Targets and sustained warning rules will be calibrated separately.
      </p>
      <div class="metrics">
        <article>
          <h3>Frame interval</h3>
          <strong>{{ measurement(latest?.frameIntervalMs) }}</strong>
          <DiagnosticTrend
            :values="snapshot.samples.map((s) => s.frameIntervalMs)"
            label="Frame interval trend, milliseconds, retained samples; gaps mean unavailable"
          />
          <p>Foreground rAF interval estimate; not universal FPS.</p>
        </article>
        <article>
          <h3>JS heap</h3>
          <strong>{{
            measurement(latest?.jsHeapBytes == null ? null : latest.jsHeapBytes / 1048576, 'MiB')
          }}</strong>
          <DiagnosticTrend
            :values="snapshot.samples.map((s) => s.jsHeapBytes)"
            label="JS heap trend, bytes, retained samples; gaps mean unavailable"
          />
          <p>{{ capabilities.memory }}</p>
        </article>
        <article>
          <h3>Long-task duration</h3>
          <strong>{{ measurement(latest?.longTaskMs) }}</strong>
          <p>Sum in the latest sample interval. {{ capabilities.longTasks }}</p>
        </article>
        <article>
          <h3>Retained operations</h3>
          <strong>{{ snapshot.timings.length }}</strong>
          <p>
            {{ snapshot.pending.index + snapshot.pending.render + snapshot.pending.other }}
            currently pending · {{ snapshot.cancellations }} session cancellations
          </p>
        </article>
      </div>
      <p>
        Up to 120 timings and 120 samples retained, sampled approximately every second. This is
        retained history, not a fixed rolling time window. No document contents are recorded.
      </p>
    </template>
    <template v-else-if="tab === 'Operations'">
      <p>
        Durations in milliseconds; completed work only. p95 requires at least 20 completed
        observations per operation. Failed/cancelled work is listed separately.
      </p>
      <div class="table-wrap">
        <table>
          <caption>
            Retained operation durations (ms)
          </caption>
          <thead>
            <tr>
              <th scope="col">Operation</th>
              <th scope="col">Count</th>
              <th scope="col">Last</th>
              <th scope="col">Median</th>
              <th scope="col">p95</th>
              <th scope="col">Worst</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in stats" :key="item.metric">
              <th scope="row">
                {{ item.name }}<small>{{ item.metric }}</small
                ><small v-if="item.cancelled || item.failed || item.unavailable"
                  >{{ item.cancelled }} cancelled · {{ item.failed }} failed ·
                  {{ item.unavailable }} unavailable</small
                >
              </th>
              <td>{{ item.count }}</td>
              <td>{{ measurement(item.last) }}</td>
              <td>{{ measurement(item.median) }}</td>
              <td>
                {{ item.p95 === null ? `Collecting (${item.count}/20)` : measurement(item.p95) }}
              </td>
              <td>{{ measurement(item.worst) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-else-if="tab === 'Resources'">
      <p>
        Application-owned resources only. A counter without a registered owner says “No registered
        owner”; this does not establish a browser-wide zero.
      </p>
      <dl class="resources">
        <template v-for="[key, name, explanation] in resources" :key="key"
          ><dt>
            {{ name }}<small>{{ explanation }}</small>
          </dt>
          <dd>
            {{
              snapshot.resources[key] === undefined
                ? 'No registered owner'
                : key === 'previewBytes'
                  ? measurement(snapshot.resources[key]! / 1048576, 'MiB estimated')
                  : snapshot.resources[key]
            }}
          </dd></template
        >
      </dl>
      <p>
        CPU, GPU and process RAM: external profiling in #16. Cache hit rates, storage usage and
        cleanup baselines are planned separately; they are not measured here.
      </p>
    </template>
    <template v-else>
      <p>
        Most recent first, up to 120 retained outcomes. Ordinary cancellation is expected during
        navigation; it is not automatically a critical condition. No per-reader attribution is
        available.
      </p>
      <p>
        Pending: {{ snapshot.pending.index }} indexing · {{ snapshot.pending.render }} rendering ·
        {{ snapshot.pending.other }} other. Dropped timings: {{ snapshot.droppedTimings }}.
      </p>
      <ol v-if="snapshot.timings.length" class="timeline">
        <li v-for="(item, index) in [...snapshot.timings].reverse()" :key="index">
          <span
            >{{ metricNames[item.metric] }}<small>{{ item.metric }}</small></span
          ><span>{{ item.outcome }} · {{ measurement(item.durationMs) }}</span>
        </li>
      </ol>
      <p v-else>No recorded operations. Open a document or browse your library while recording.</p>
    </template>
  </div>
</template>
<style scoped>
.scope {
  color: var(--pt-muted);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 1px solid var(--pt-line);
  padding-bottom: 8px;
}
button {
  padding: 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--pt-ink);
  border: 1px solid var(--pt-line);
}
button[aria-selected='true'] {
  background: var(--pt-brand);
  color: var(--pt-on-brand, var(--pt-panel));
}
p {
  margin: 10px 0;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
article {
  padding: 12px;
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  min-width: 0;
}
h3 {
  font-weight: 600;
  margin-bottom: 4px;
}
strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
article p,
small {
  color: var(--pt-muted);
  font-size: 12px;
}
small {
  display: block;
  overflow-wrap: anywhere;
  font-weight: 400;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
caption {
  text-align: left;
  padding: 8px 0;
}
th,
td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid var(--pt-line);
}
.resources {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}
dd {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.timeline li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--pt-line);
}
@media (max-width: 420px) {
  .metrics {
    grid-template-columns: 1fr;
  }
  .resources {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  dd {
    text-align: left;
    margin-bottom: 12px;
  }
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
</style>

<script setup lang="ts">
import type { IndicatorResult, IndicatorEvent } from './indicators'
import { computed } from 'vue'
import DiagnosticTimeline from './DiagnosticTimeline.vue'
import DiagnosticTrend from './DiagnosticTrend.vue'
import { measurement, operationStats, type Snapshot, type DiagnosticView } from './presentation'
const props = defineProps<{
  snapshot: Snapshot
  capabilities: Record<string, string>
  health?: IndicatorResult
  indicatorHistory?: IndicatorEvent[]
}>()
const tabs = [
  'Overview',
  'Sensors',
  'Operations',
  'Resources',
  'Timeline',
  'Technical details',
] as const
const active = defineModel<DiagnosticView>('activeTab', { default: 'Overview' })
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
  <div v-if="health" class="indicator-summary" :data-state="health.state" role="status">
    <strong
      >{{
        health.state === 'attention' || health.state === 'critical'
          ? '⚠'
          : health.state === 'recording'
            ? '✓'
            : '○'
      }}
      {{ health.label }}</strong
    >
    <p>{{ health.explanation }}</p>
    <ul>
      <li v-for="finding in health.findings" :key="finding.id">
        <strong>{{ finding.reason }}</strong>
        <p>{{ finding.next }}</p>
      </li>
    </ul>
  </div>
  <p class="scope">
    {{ snapshot.running ? 'Recording' : 'Paused · retained readings' }} · Targets not configured by
    default
  </p>
  <div role="tablist" aria-label="Diagnostic views" class="tabs">
    <button
      v-for="(tab, index) in tabs"
      :id="`diagnostic-tab-${tab}`"
      :key="tab"
      type="button"
      role="tab"
      class="pt-plain-control"
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
        Responsiveness indicators use provisional rules. Operation targets stay unconfigured until
        explicitly set; calibrated workload budgets remain in #16.
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
    <template v-else-if="tab === 'Sensors'">
      <slot name="sensors" />
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
      <slot name="operation-profiles" />
    </template>
    <template v-else-if="tab === 'Resources'">
      <slot name="resource-investigation">
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
          CPU, GPU and process RAM require external profiling in #16. Owner totals are not
          browser-wide measurements.
        </p>
      </slot>
    </template>
    <template v-else-if="tab === 'Timeline'">
      <DiagnosticTimeline :history="indicatorHistory ?? []" :snapshot="snapshot" :health="health" />
    </template>
    <slot v-else name="technical" />
  </div>
</template>
<style scoped>
.indicator-summary {
  border-left: 3px solid var(--pt-muted);
  padding-left: 10px;
}
.indicator-summary[data-state='recording'] {
  border-color: light-dark(#20824d, #71d69a);
}
.indicator-summary[data-state='attention'] {
  border-color: light-dark(#966500, #f0bd58);
}
.indicator-summary[data-state='critical'] {
  border-color: light-dark(#bb3737, #ff9393);
}
.scope {
  color: var(--pt-muted);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-top: 1px solid var(--pt-line);
  border-bottom: 1px solid var(--pt-line);
  background: var(--pt-panel);
  margin: 0 calc(-1 * var(--diagnostic-content-inset, 14px));
  padding: 10px var(--diagnostic-content-inset, 14px);
}
button {
  padding: 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--pt-ink);
  border: 1px solid var(--pt-line);
}
.tabs button {
  border-color: transparent;
}
button[aria-selected='true'] {
  background: light-dark(#23686b, #285a60);
  color: #ffffff;
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

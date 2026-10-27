<script setup lang="ts">
import { computed, ref } from 'vue'
import type { IndicatorEvent, IndicatorResult } from './indicators'
import type { Snapshot } from './presentation'
import { measurement, metricNames } from './presentation'
import { profileNames } from './operation-profiles'
import UiIcon from '../../components/UiIcon.vue'
import {
  buildTimeline,
  isWarning,
  stateLabels,
  timelineTime,
  type Incident,
  type TimelineRow,
  type TimelineFilter,
} from './timeline'
const props = defineProps<{
  history: IndicatorEvent[]
  snapshot: Snapshot
  health?: IndicatorResult
}>()
const filter = ref<TimelineFilter>('all')
const filters: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: 'All events' },
  { key: 'incidents', label: 'Incidents only' },
  { key: 'transitions', label: 'Transitions only' },
]
const model = computed(() => buildTimeline(props.history, props.snapshot.timings))
const rows = computed(() =>
  filter.value === 'transitions'
    ? model.value.transitions
    : model.value.rows.filter((row) => filter.value !== 'incidents' || row.kind === 'incident'),
)
const selected = ref<string | null | undefined>(undefined)
const firstIncident = computed(() => model.value.incidents[0]?.id)
function expanded(id: string) {
  return selected.value === undefined ? firstIncident.value === id : selected.value === id
}
function toggle(id: string) {
  selected.value = expanded(id) ? null : id
}
function severity(row: TimelineRow) {
  return row.kind === 'incident'
    ? row.incident.state
    : row.kind === 'transition'
      ? row.event.state
      : 'neutral'
}
function heading(row: TimelineRow) {
  if (row.kind === 'incident') return row.incident.title
  if (row.kind === 'operation')
    return `${metricNames[row.operation.metric]} · ${row.operation.outcome}`
  return stateLabels[row.event.state]
}
function peak(incident: Incident) {
  const candidates = incident.findings.some((f) => f.state === 'critical')
    ? incident.findings.filter((f) => f.state === 'critical')
    : incident.findings
  return candidates.reduce(
    (best, finding) => ((finding.observedMs ?? -1) > (best?.observedMs ?? -1) ? finding : best),
    candidates[0],
  )
}
function duration(incident: Incident) {
  return measurement(
    Math.max(0, (incident.endMs ?? incident.lastSeenAtMs) - incident.atMs) / 1000,
    's',
  )
}
function detailId(id: string) {
  return `diagnostic-incident-${encodeURIComponent(id)}`
}
</script>
<template>
  <div class="session-heading">
    <div>
      <h3>Session timeline</h3>
      <small
        >{{ model.eventCount }} events grouped into {{ model.incidents.length }} incidents</small
      >
    </div>
    <span v-if="health" class="current-state" :data-state="health.state">{{ health.label }}</span>
  </div>
  <div class="controls">
    <div class="filters" role="group" aria-label="Timeline filter">
      <button
        v-for="option in filters"
        :key="option.key"
        type="button"
        class="pt-plain-control"
        :aria-pressed="filter === option.key"
        @click="filter = option.key"
      >
        {{ option.label }}
      </button>
    </div>
    <small aria-live="polite"
      >{{ rows.length }}
      {{
        filter === 'transitions' ? 'transitions' : filter === 'incidents' ? 'incidents' : 'groups'
      }}
      · oldest first</small
    >
  </div>
  <ol class="session-timeline" aria-label="Chronological diagnostic events">
    <li v-for="row in rows" :key="row.id" class="entry" :data-kind="severity(row)">
      <span class="time"
        ><time>{{ timelineTime(row.atMs) }}</time
        ><span class="sr-only"> since page start</span></span
      >
      <div class="rail" aria-hidden="true" />
      <div class="event">
        <template v-if="row.kind === 'incident'">
          <button
            type="button"
            class="event-header pt-plain-control"
            :aria-expanded="expanded(row.id)"
            :aria-controls="detailId(row.id)"
            @click="toggle(row.id)"
          >
            <span class="event-title"
              ><strong>{{ row.incident.title }}</strong
              ><span class="tags"
                ><span class="tag" :class="row.incident.state">{{
                  stateLabels[row.incident.state]
                }}</span
                ><span class="tag">{{ row.incident.status }}</span
                ><UiIcon name="next" :class="{ rotated: expanded(row.id) }" /></span
            ></span>
            <span class="secondary"
              >{{ timelineTime(row.incident.atMs) }}–{{
                row.incident.endMs === undefined ? 'ongoing' : timelineTime(row.incident.endMs)
              }}
              · {{ duration(row.incident)
              }}<template v-if="peak(row.incident)?.observedMs !== undefined">
                · peak {{ measurement(peak(row.incident)?.observedMs) }}</template
              ></span
            >
          </button>
          <div v-show="expanded(row.id)" :id="detailId(row.id)" class="detail">
            <div class="detail-top">
              <div>
                <small
                  >Peak
                  {{
                    peak(row.incident)?.id === 'frames'
                      ? 'frame interval'
                      : peak(row.incident)?.id === 'long-tasks'
                        ? 'long-task sum / interval'
                        : 'captured duration'
                  }}</small
                ><strong>{{ measurement(peak(row.incident)?.observedMs) }}</strong>
              </div>
              <div>
                <small>Captured target</small
                ><strong>{{ measurement(peak(row.incident)?.thresholdMs) }} · provisional</strong>
              </div>
              <div>
                <small>Duration</small><strong>{{ duration(row.incident) }}</strong>
              </div>
            </div>
            <ol class="sequence" aria-label="Incident state changes">
              <li v-for="(event, index) in row.incident.transitions" :key="index">
                <time>{{ timelineTime(event.atMs) }}</time
                ><span class="state" :data-state="event.state">{{
                  event.state === 'recording' ? 'Recovered' : stateLabels[event.state]
                }}</span
                ><span class="secondary">{{
                  isWarning(event.state)
                    ? event.findings
                        .map((f) =>
                          f.observedMs === undefined
                            ? f.id
                            : `${measurement(f.observedMs)} · ${f.id}`,
                        )
                        .join('; ')
                    : event.explanation
                }}</span>
              </li>
            </ol>
            <h4>Observed signal</h4>
            <p v-for="finding in row.incident.findings" :key="finding.id">{{ finding.reason }}</p>
            <h4>Nearby recorded work</h4>
            <div v-if="row.incident.evidence.context.length" class="correlation">
              <span v-for="(operation, index) in row.incident.evidence.context" :key="index"
                >{{ profileNames[operation.metric] }} · {{ operation.outcome }} ·
                {{ measurement(operation.durationMs) }}</span
              >
            </div>
            <p v-else>No nearby instrumented operation was captured.</p>
            <p class="secondary">
              Correlated activity; the exact root cause is not yet attributed. Timing proximity does
              not establish the root cause.
            </p>
            <h4>Investigate next</h4>
            <p v-for="finding in row.incident.findings" :key="finding.id">{{ finding.next }}</p>
            <details v-if="row.incident.operations.length">
              <summary class="pt-text-action">
                Recorded work during incident · {{ row.incident.operations.length }} operations
              </summary>
              <ul>
                <li v-for="(operation, index) in row.incident.operations" :key="index">
                  {{ timelineTime(operation.endedAtMs!) }} · {{ metricNames[operation.metric] }} ·
                  {{ operation.outcome }} · {{ measurement(operation.durationMs) }}
                </li>
              </ul>
            </details>
            <details>
              <summary class="pt-text-action">
                Captured rules · {{ row.incident.evaluations }} evaluations
              </summary>
              <div
                v-for="(event, index) in row.incident.transitions.filter((e) => isWarning(e.state))"
                :key="index"
              >
                <small>{{ timelineTime(event.atMs) }} · {{ stateLabels[event.state] }}</small>
                <pre>{{ JSON.stringify(event.configuration, null, 2) }}</pre>
              </div>
            </details>
          </div>
        </template>
        <div v-else class="event-header">
          <h3>{{ heading(row) }}</h3>
          <template v-if="row.kind === 'operation'"
            ><p class="secondary">
              {{ measurement(row.operation.durationMs)
              }}<template v-if="row.operation.outcome === 'cancelled'">
                · expected cancellation when work is replaced</template
              >
            </p></template
          >
          <template v-else
            ><p class="secondary">{{ row.event.explanation }}</p>
            <details v-if="row.event.findings.length">
              <summary class="pt-text-action">Observed signal and captured rules</summary>
              <div v-for="finding in row.event.findings" :key="finding.id">
                <p>{{ finding.reason }}</p>
                <p>{{ finding.next }}</p>
              </div>
              <pre>{{ JSON.stringify(row.event.configuration, null, 2) }}</pre>
            </details></template
          >
        </div>
      </div>
    </li>
  </ol>
  <p v-if="!rows.length" class="empty">
    {{
      filter === 'incidents'
        ? 'No retained performance incidents.'
        : filter === 'transitions'
          ? 'No retained transitions.'
          : 'No recorded operations or transitions. Open a document or browse your library while recording.'
    }}
  </p>
  <p v-if="model.unpositionedOperations" class="secondary">
    {{ model.unpositionedOperations }} retained operations lack timestamps and cannot be positioned
    on this timeline.
  </p>
  <p class="retention">
    Times are since page start. Repeated samples stay inside one incident. Recovered incidents
    remain available until reset or reload. Up to 120 transitions and 120 operations retained;
    export JSON to keep them.
  </p>
</template>
<style scoped>
.session-heading,
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.session-heading {
  margin: 16px 0 12px;
}
h3 {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}
small,
.secondary,
.time {
  font-size: 12px;
  color: var(--pt-muted);
}
.current-state {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.current-state::before {
  content: '';
  width: 7px;
  height: 7px;
  background: var(--pt-muted);
  border-radius: 50%;
}
.current-state[data-state='recording']::before {
  background: light-dark(#247447, #8bddaa);
}
.controls {
  margin-bottom: 16px;
}
.filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
button {
  font: inherit;
  color: var(--pt-ink);
  cursor: pointer;
}
.filters button {
  font-size: 12px;
  background: var(--pt-panel);
  border: 1px solid var(--pt-line);
  border-radius: 6px;
  padding: 6px 9px;
}
.filters button[aria-pressed='true'] {
  background: var(--pt-canvas);
  border-color: var(--pt-brand);
}
.session-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry {
  display: grid;
  grid-template-columns: 46px 14px minmax(0, 1fr);
  column-gap: 12px;
  position: relative;
}
.time {
  font-variant-numeric: tabular-nums;
  padding-top: 13px;
}
.rail {
  position: relative;
  color: var(--pt-muted);
}
.rail::before {
  content: '';
  position: absolute;
  top: 17px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pt-panel);
  border: 2px solid currentColor;
  z-index: 1;
}
.rail::after {
  content: '';
  position: absolute;
  top: 23px;
  bottom: -23px;
  left: 6px;
  width: 1px;
  background: var(--pt-line);
}
.entry:last-child .rail::after {
  display: none;
}
.entry[data-kind='critical'] .rail {
  color: light-dark(#b63b3b, #ffabab);
}
.entry[data-kind='attention'] .rail {
  color: light-dark(#916000, #f5c56c);
}
.entry[data-kind='recording'] .rail {
  color: light-dark(#247447, #8bddaa);
}
.event {
  min-width: 0;
  padding-bottom: 14px;
}
.event-header {
  padding: 10px 0;
  min-height: 48px;
}
button.event-header {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
}
.event-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
strong {
  font-weight: 500;
}
.tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}
.tag {
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--pt-canvas);
  white-space: nowrap;
}
.critical,
.state[data-state='critical'] {
  color: light-dark(#b63b3b, #ffabab);
}
.attention,
.state[data-state='attention'] {
  color: light-dark(#916000, #f5c56c);
}
.state[data-state='recording'] {
  color: light-dark(#247447, #8bddaa);
}
.tags :deep(svg) {
  width: 14px;
  height: 14px;
  transition: transform 0.15s;
}
.rotated {
  transform: rotate(90deg);
}
.detail {
  padding: 12px;
  background: var(--pt-canvas);
  border-radius: 8px;
  margin-bottom: 4px;
}
.detail-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.detail-top strong {
  display: block;
  font-variant-numeric: tabular-nums;
}
.sequence {
  list-style: none;
  padding: 0 0 0 11px;
  margin: 12px 0;
  border-left: 1px solid var(--pt-line);
}
.sequence li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 5px 0;
  font-size: 12px;
}
.sequence time {
  color: var(--pt-muted);
  font-variant-numeric: tabular-nums;
}
h4 {
  font-size: 12px;
  font-weight: 500;
  margin: 10px 0 3px;
}
p {
  margin: 0;
  font-size: 12px;
}
.correlation {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 6px 0;
}
.correlation span {
  font-size: 12px;
  background: var(--pt-panel);
  padding: 3px 6px;
  border-radius: 4px;
}
details {
  margin-top: 10px;
  font-size: 12px;
}
summary {
  cursor: pointer;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.retention {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--pt-line);
  font-size: 12px;
  color: var(--pt-muted);
}
.empty {
  padding: 24px 0;
  color: var(--pt-muted);
}
@media (max-width: 420px) {
  .entry {
    grid-template-columns: 38px 12px minmax(0, 1fr);
    column-gap: 7px;
  }
  .detail {
    padding: 10px;
  }
  .tags {
    gap: 4px;
  }
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tags :deep(svg) {
    transition: none;
  }
}
</style>

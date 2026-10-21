<script setup lang="ts">
import { computed } from 'vue'
import type { SensorSnapshot } from './responsiveness'
import SensorTrend from './SensorTrend.vue'
import { measurement, P95_MIN_SAMPLES } from './presentation'
import { sensorView, type SensorKind } from './sensor-presentation'
const props = defineProps<{ snapshot: SensorSnapshot; enabled: boolean }>()
defineEmits<{ toggle: [] }>()
const selected = defineModel<SensorKind>('selected', { default: 'inputs' })
const categories = [
  ['inputs', 'Inputs'],
  ['frames', 'Long frames'],
  ['loading', 'Loading'],
] as const
const descriptions = {
  inputs: {
    heading: 'How quickly did input respond?',
    source: 'Event Timing',
    latest: 'Latest longest event',
    capability: 'event',
    note: 'Eligible interactions only · Rounded durations · Not page INP',
    interpretation:
      'High wait: inspect main-thread contention. High handler time: inspect interaction code. Event duration includes more than waiting and handler execution; do not infer an exact paint time from its rounded remainder.',
  },
  frames: {
    heading: 'Where did the frame spend time?',
    source: 'Long Animation Frames',
    latest: 'Latest long frame',
    capability: 'long-animation-frame',
    note: 'Only frames over 50 ms · Phases overlap; do not add these rows',
    interpretation:
      'Inspect rendering/style work and captured script categories. Long animation frames overlap Long Tasks; do not add both to a score. Script attribution may be partial.',
  },
  loading: {
    heading: 'How long did resources take to load?',
    source: 'Resource Timing',
    latest: 'Latest resource load',
    capability: 'resource',
    note: 'Browser resources only · Does not measure local PDF/EPUB file reads',
    interpretation:
      'Inspect network loading separately from local document-open timings. Zero transfer can mean cache, restricted cross-origin timing or a non-network source. No URLs or filenames are stored.',
  },
} as const
const description = computed(() => descriptions[selected.value])
const view = computed(() => sensorView(props.snapshot, selected.value))
const capability = computed(() => props.snapshot.capabilities[description.value.capability])
function selectKey(event: KeyboardEvent, index: number) {
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? 2
        : event.key === 'ArrowRight'
          ? (index + 1) % 3
          : event.key === 'ArrowLeft'
            ? (index + 2) % 3
            : null
  if (next === null) return
  event.preventDefault()
  selected.value = categories[next]![0]
  ;(event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')[next]?.focus()
}
function barWidth(value: number | null) {
  return value === null
    ? 0
    : Math.min(
        100,
        (value /
          Math.max(
            1,
            view.value.latest ?? 0,
            ...view.value.breakdown.map((row) => row.value ?? 0),
          )) *
          100,
      )
}
</script>
<template>
  <section class="sensors" aria-label="Responsiveness and loading sensors">
    <div class="sensor-head">
      <div>
        <h3>Browser sensors</h3>
        <p class="muted">
          {{
            snapshot.active
              ? 'Enabled · Foreground activity · Current frame'
              : enabled
                ? 'Sampling paused · Retained readings'
                : 'Sensors off · Retained readings'
          }}
        </p>
      </div>
      <label class="sensor-toggle"
        ><input type="checkbox" :checked="enabled" @change="$emit('toggle')" />Capture
        sensors</label
      >
    </div>
    <div class="segments" role="tablist" aria-label="Sensor categories">
      <button
        v-for="([kind, label], index) in categories"
        :id="`sensor-tab-${kind}`"
        :key="kind"
        type="button"
        class="pt-plain-control"
        role="tab"
        :aria-selected="selected === kind"
        :aria-controls="`sensor-detail-${kind}`"
        :tabindex="selected === kind ? 0 : -1"
        @click="selected = kind"
        @keydown="selectKey($event, index)"
      >
        {{ label }}
      </button>
    </div>
    <div
      :id="`sensor-detail-${selected}`"
      role="tabpanel"
      :aria-labelledby="`sensor-tab-${selected}`"
    >
      <h3>{{ description.heading }}</h3>
      <p class="muted">
        {{ description.source }} ·
        {{ snapshot.active ? 'Foreground browser readings' : 'Retained readings' }}
      </p>
      <p v-if="!snapshot.active || capability.startsWith('Unavailable')" class="capability">
        {{ capability }}
      </p>
      <div class="segment-summary">
        <div>
          <div class="scope-label">{{ description.latest }}</div>
          <strong class="headline"
            >{{ measurement(view.latest).replace(' ms', '')
            }}<small v-if="view.latest !== null"> ms</small></strong
          >
        </div>
        <p class="muted count">
          {{ view.stats.count }} retained observations<br />No calibrated target
        </p>
      </div>
      <SensorTrend
        :values="view.values"
        :label="`${description.source} retained observation durations, milliseconds`"
      />
      <dl class="stats">
        <div>
          <dt>Median</dt>
          <dd>{{ measurement(view.stats.median) }}</dd>
        </div>
        <div>
          <dt>Worst observed</dt>
          <dd>{{ measurement(view.stats.worst) }}</dd>
        </div>
        <div>
          <dt>p95</dt>
          <dd>
            {{
              view.stats.count >= P95_MIN_SAMPLES ? measurement(view.stats.p95) : 'Not enough data'
            }}
          </dd>
        </div>
      </dl>
      <template v-if="view.breakdown.length">
        <p class="scope-label">Latest observation breakdown</p>
        <dl class="rows">
          <div v-for="row in view.breakdown" :key="row.label" class="reading">
            <dt>{{ row.label }}</dt>
            <dd class="track" aria-hidden="true">
              <span class="fill" :style="{ width: `${barWidth(row.value)}%` }" />
            </dd>
            <dd class="value">{{ measurement(row.value) }}</dd>
          </div>
        </dl>
      </template>
      <p class="muted">{{ description.note }}</p>
      <details :key="selected">
        <summary class="pt-text-action">How to read this / captured evidence</summary>
        <dl class="evidence">
          <dt>Observed readings</dt>
          <dd>
            {{ view.stats.count }} of up to 120 retained; statistics cover retained observations,
            not a fixed time window. p95 needs at least {{ P95_MIN_SAMPLES }} readings.
          </dd>
          <dt>API status</dt>
          <dd>{{ capability }}</dd>
          <template v-if="selected === 'inputs'"
            ><dt>Collection threshold</dt>
            <dd>
              Requested event duration ≥ 16 ms; browser duration rounding (typically 8 ms).
              Continuous scroll/move and unreported short events are excluded. Longest observed
              eligible event per interaction; not page INP.
            </dd></template
          >
          <template v-if="selected === 'frames'"
            ><dt>Attribution</dt>
            <dd>
              Event / callback / other; no script URLs. Up to 120 scripts per frame; missing fields
              are unavailable.
            </dd></template
          >
          <template v-if="selected === 'loading'"
            ><dt>Latest category</dt>
            <dd>{{ view.resource?.category ?? 'Unavailable' }}</dd>
            <dt>Transfer size</dt>
            <dd>{{ measurement(view.resource?.transferBytes, 'bytes') }}</dd>
            <dt>Encoded body</dt>
            <dd>{{ measurement(view.resource?.encodedBytes, 'bytes') }}</dd></template
          >
          <dt>Coverage</dt>
          <dd>
            Current frame; EPUB iframe and worker activity is not fully covered.
            {{ snapshot.scope.secureContext ? 'Secure context.' : 'Not a secure context.' }}
            {{ snapshot.scope.frame }}.
          </dd>
          <dt>Interpretation</dt>
          <dd>{{ description.interpretation }}</dd>
        </dl>
      </details>
      <div class="notice">Informational · Not included in the overall health indicator</div>
    </div>
  </section>
</template>
<style scoped>
.sensors {
  margin-top: 16px;
  min-width: 0;
}
.sensor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}
p {
  margin: 0;
}
.muted,
.capability {
  color: var(--pt-muted);
  font-size: 12px;
}
.capability {
  margin: 8px 0;
}
.sensor-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 500;
}
input {
  width: 16px;
  height: 16px;
  accent-color: var(--pt-brand);
}
.segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 3px;
  gap: 3px;
  background: var(--pt-canvas);
  border-radius: 7px;
  margin-bottom: 18px;
}
.segments button {
  color: var(--pt-ink);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  padding: 6px 9px;
  min-height: 32px;
}
.segments button:hover {
  background: var(--pt-canvas);
}
.segments button[aria-selected='true'] {
  background: var(--pt-panel);
  border-color: var(--pt-line);
  font-weight: 600;
}
.segment-summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin: 16px 0;
}
.headline {
  font-size: 30px;
  line-height: 1.2;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.headline small {
  font-size: 14px;
  font-weight: 400;
  color: var(--pt-muted);
}
.count {
  text-align: right;
}
.scope-label {
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--pt-muted);
  margin-bottom: 4px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 0;
  border-block: 1px solid var(--pt-line);
  margin: 12px 0 18px;
}
.stats dt {
  color: var(--pt-muted);
  font-size: 12px;
}
.stats dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.rows {
  display: grid;
  gap: 12px;
  margin: 14px 0;
}
.reading {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) 85px;
  gap: 10px;
  align-items: center;
}
dd {
  margin: 0;
}
.track {
  height: 6px;
  background: var(--pt-canvas);
  border-radius: 4px;
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--pt-brand);
  border-radius: 4px;
}
.value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
details {
  border-top: 1px solid var(--pt-line);
  padding-top: 12px;
  margin-top: 14px;
}
summary {
  font-weight: 500;
  min-height: 32px;
}
.evidence {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr);
  gap: 7px 12px;
  margin: 10px 0;
  font-size: 12px;
}
.evidence dt {
  font-weight: 600;
}
.evidence dd {
  overflow-wrap: anywhere;
}
.notice {
  background: var(--pt-canvas);
  padding: 9px 12px;
  border-radius: 5px;
  color: var(--pt-muted);
  font-size: 12px;
  margin-top: 14px;
}
@media (max-width: 440px) {
  .reading {
    grid-template-columns: 118px minmax(0, 1fr) 70px;
    gap: 7px;
  }
  .headline {
    font-size: 26px;
  }
  .stats dd {
    font-size: 14px;
  }
}
@media (pointer: coarse) {
  .segments button,
  summary,
  .sensor-toggle {
    min-height: 44px;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { version } from '../../../package.json'
import { diagnostics } from './recorder'
import IconButton from '../../components/IconButton.vue'
import { triggerHealth, triggerRules } from './health'
import type { Snapshot } from './presentation'
import DiagnosticDashboard from './DiagnosticDashboard.vue'
import { capabilities, startSampler } from './sampler'
import { downloadJson } from '../../services/file-download'
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const minimized = ref(false)
const lastOverhead = ref<ReturnType<typeof startSampler>['overhead'] | null>(null)
const snapshot = ref(diagnostics.snapshot())
const available = ref(capabilities())
const identity = {
  environment: import.meta.env.VITE_DEPLOY_CHANNEL || 'development',
  version,
  sourceSha: __DIAGNOSTIC_SOURCE__.sha,
  workingTree: __DIAGNOSTIC_SOURCE__.dirty
    ? 'Modified working tree; SHA identifies base revision'
    : 'Clean',
}
const recentSamples = ref<Snapshot['samples']>([])
const health = computed(() =>
  triggerHealth(open.value && snapshot.value.running, recentSamples.value),
)
let sampler: ReturnType<typeof startSampler> | undefined
function refresh(recordSample = false) {
  snapshot.value = diagnostics.snapshot()
  if (recordSample) {
    if (document.hidden) recentSamples.value = []
    else if (snapshot.value.samples.length)
      recentSamples.value = [...recentSamples.value, snapshot.value.samples.at(-1)!].slice(-3)
  }
  if (sampler) lastOverhead.value = { ...sampler.overhead }
}
function pause() {
  if (sampler) lastOverhead.value = { ...sampler.overhead }
  sampler?.stop()
  sampler = undefined
  diagnostics.pause()
  refresh()
}
function resume() {
  if (sampler) return
  diagnostics.resume()
  recentSamples.value = []
  sampler = startSampler(() => refresh(true))
  available.value = sampler.available
  refresh()
}
function minimize() {
  minimized.value = true
  void nextTick(() => trigger.value?.focus())
}
function toggle() {
  if (open.value && minimized.value) {
    minimized.value = false
    return
  }
  minimized.value = false
  open.value = !open.value
  if (open.value) resume()
  else {
    pause()
    void nextTick(() => trigger.value?.focus())
  }
}
function reset() {
  const running = diagnostics.running
  sampler?.stop()
  sampler = undefined
  diagnostics.reset()
  lastOverhead.value = null
  if (running) resume()
  else refresh()
}
function exportSummary() {
  downloadJson(
    JSON.stringify(
      {
        ...diagnostics.snapshot(),
        identity,
        capabilities: available.value,
        samplerOverhead: sampler?.overhead ?? lastOverhead.value,
        triggerRules,
        limits: { retainedTimings: 120, retainedSamples: 120, intervalMs: 1000 },
      },
      null,
      2,
    ),
    'papertrail-diagnostics.json',
  )
}
function keyboard(event: KeyboardEvent) {
  if (event.ctrlKey && event.altKey && event.code === 'KeyD') {
    event.preventDefault()
    toggle()
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    open.value = false
    pause()
    void nextTick(() => trigger.value?.focus())
  }
}
onMounted(() => window.addEventListener('keydown', keyboard))
onBeforeUnmount(() => {
  pause()
  window.removeEventListener('keydown', keyboard)
})
</script>
<template>
  <aside
    class="developer-diagnostics"
    :class="{ expanded: open && !minimized }"
    aria-label="Developer diagnostics"
  >
    <button
      v-show="!open || minimized"
      ref="trigger"
      aria-label="Developer diagnostics"
      aria-describedby="diagnostics-trigger-status"
      class="diagnostics-trigger"
      type="button"
      :aria-expanded="open && !minimized"
      aria-controls="developer-diagnostics-panel"
      @click="toggle"
    >
      <span class="pulse-loader" :data-state="health.state" aria-hidden="true">
        <span class="pulse-core" /><span
          v-for="ring in 4"
          :key="ring"
          class="pulse-ring"
          :style="{ animationDelay: `${(ring - 1) * 0.6}s` }"
        />
      </span>
      <span>Developer diagnostics</span
      ><span id="diagnostics-trigger-status" role="status" class="sr-only">
        · {{ health.label }}</span
      >
    </button>
    <section
      v-if="open && !minimized"
      id="developer-diagnostics-panel"
      aria-label="Diagnostic measurements"
    >
      <header>
        <div class="title">
          <h2>Developer diagnostics</h2>
          <p>PaperTrail · Local session · v{{ identity.version }}</p>
        </div>
        <div class="actions">
          <IconButton
            :label="snapshot.running ? 'Pause' : 'Resume'"
            :icon="snapshot.running ? 'pause' : 'play'"
            @click="snapshot.running ? pause() : resume()"
          />
          <IconButton label="Minimize diagnostics" icon="minimize" @click="minimize" />
          <IconButton label="Close diagnostics" icon="close" @click="toggle" />
        </div>
      </header>
      <div class="dashboard-content">
        <DiagnosticDashboard :snapshot="snapshot" :capabilities="available">
          <template #technical>
            <h3>Build and session</h3>

            <dl>
              <template v-for="(value, key) in identity" :key="key"
                ><dt>{{ key }}</dt>
                <dd>{{ value }}</dd></template
              >
            </dl>
            <p>Session {{ snapshot.session }}</p>
            <h3>Capabilities</h3>
            <ul>
              <li v-for="(value, key) in available" :key="key">{{ key }}: {{ value }}</li>
            </ul>
            <h3>Sampler callback overhead</h3>
            <p v-if="lastOverhead?.samples">
              {{ lastOverhead.samples }} completed callbacks ·
              {{ lastOverhead.totalMs.toFixed(2) }} ms total ·
              {{ lastOverhead.maxMs.toFixed(2) }} ms maximum
            </p>
            <p v-else>No completed sampling callbacks yet.</p>
            <h3>Owned resources (raw)</h3>
            <pre>{{ JSON.stringify(snapshot.resources, null, 2) }}</pre>
            <h3>Latest sample (raw)</h3>
            <pre>{{
              JSON.stringify(snapshot.samples.at(-1) ?? 'Unavailable: waiting for sample', null, 2)
            }}</pre>
            <p>
              At most 120 timings/samples retained. Sampling callback timing in the export covers
              synchronous sampler/snapshot work only, not all rendering or diagnostic overhead.
            </p>
            <h3>Minimized indicator rules (provisional)</h3>
            <p>
              {{ health.label }}. Green means recording without a detected sustained signal, not a
              calibrated performance pass. Yellow/red require three consecutive recent samples above
              the configured frame-interval or long-task thresholds. Paused/closed is gray; resuming
              starts a fresh signal window.
            </p>
            <pre>{{ JSON.stringify(triggerRules, null, 2) }}</pre>
          </template>
        </DiagnosticDashboard>
      </div>
      <footer>
        <small>Local only · Ctrl+Alt+D · Escape closes</small>
        <div class="actions">
          <IconButton label="Reset session" icon="refresh" @click="reset" />
          <IconButton label="Export local JSON" icon="download" @click="exportSummary" />
        </div>
      </footer>
    </section>
  </aside>
</template>
<style scoped>
.developer-diagnostics {
  position: fixed;
  right: 12px;
  bottom: 0;
  z-index: 150;
  color: var(--pt-ink);
  font: 13px/1.5 system-ui;
  max-width: calc(100vw - 24px);
}
section {
  width: min(650px, calc(100vw - 24px));
  max-height: min(760px, 85dvh);
  display: flex;
  flex-direction: column;
  background: var(--pt-panel);
  border: 1px solid var(--pt-line);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px;
  background: var(--pt-canvas);
  flex-shrink: 0;
}
header {
  border-bottom: 1px solid var(--pt-line);
}
footer {
  border-top: 1px solid var(--pt-line);
}
.title {
  flex: 1;
  min-width: 140px;
}
h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.title p,
footer small {
  color: var(--pt-muted);
  font-size: 12px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.dashboard-content {
  padding: 12px 14px;
  overflow: auto;
  min-height: 0;
}
h3 {
  font-weight: 600;
  margin: 12px 0 4px;
}
dd,
pre {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
dt {
  font-weight: 600;
}
.diagnostics-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  border: 1px solid var(--pt-line);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  min-height: 44px;
}
.pulse-loader {
  --signal: var(--pt-muted);
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.pulse-loader[data-state='recording'] {
  --signal: light-dark(#20824d, #71d69a);
}
.pulse-loader[data-state='attention'] {
  --signal: light-dark(#966500, #f0bd58);
}
.pulse-loader[data-state='critical'] {
  --signal: light-dark(#bb3737, #ff9393);
}
.pulse-core,
.pulse-ring {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--signal);
}
.pulse-core {
  z-index: 1;
}
.pulse-ring {
  animation: diagnostic-radiate 2.4s infinite cubic-bezier(0.36, 0.11, 0.32, 1);
}
.pulse-loader[data-state='inactive'] .pulse-ring {
  display: none;
  animation: none;
}
@keyframes diagnostic-radiate {
  from {
    transform: scale(1);
    opacity: 0.65;
  }
  to {
    transform: scale(3.2);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pulse-ring {
    display: none;
    animation: none;
  }
}
@media (max-width: 420px) {
  header,
  footer {
    padding: 8px;
  }
  .dashboard-content {
    padding: 10px;
  }
}
</style>

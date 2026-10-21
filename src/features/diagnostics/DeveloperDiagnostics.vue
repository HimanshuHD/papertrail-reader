<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { version } from '../../../package.json'
import { diagnostics } from './recorder'
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
let sampler: ReturnType<typeof startSampler> | undefined
function refresh() {
  snapshot.value = diagnostics.snapshot()
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
  sampler = startSampler(refresh)
  available.value = sampler.available
  refresh()
}
function minimize() {
  minimized.value = true
  trigger.value?.focus()
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
    trigger.value?.focus()
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
    trigger.value?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', keyboard))
onBeforeUnmount(() => {
  pause()
  window.removeEventListener('keydown', keyboard)
})
</script>
<template>
  <aside class="developer-diagnostics" aria-label="Developer diagnostics">
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open && !minimized"
      aria-controls="developer-diagnostics-panel"
      @click="toggle"
    >
      Developer diagnostics
    </button>
    <span v-if="open && minimized"> · {{ snapshot.running ? 'Sampling' : 'Paused' }}</span>
    <section
      v-if="open && !minimized"
      id="developer-diagnostics-panel"
      aria-label="Diagnostic measurements"
    >
      <div class="heading">
        <h2>Developer diagnostics</h2>
        <button type="button" aria-label="Minimize diagnostics" @click="minimize">Minimize</button>
      </div>
      <p>Local measurements · Ctrl+Alt+D · Escape closes and stops sampling.</p>
      <div class="actions">
        <button v-if="snapshot.running" @click="pause">Pause</button
        ><button v-else @click="resume">Resume</button><button @click="reset">Reset session</button
        ><button @click="exportSummary">Export local JSON</button
        ><button @click="toggle">Close diagnostics</button>
      </div>
      <DiagnosticDashboard :snapshot="snapshot" :capabilities="available" />
      <details>
        <summary>Technical details</summary>
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
          {{ lastOverhead.samples }} completed callbacks · {{ lastOverhead.totalMs.toFixed(2) }} ms
          total · {{ lastOverhead.maxMs.toFixed(2) }} ms maximum
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
      </details>
    </section>
  </aside>
</template>
<style scoped>
.developer-diagnostics {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  color: var(--pt-ink);
  background: var(--pt-panel);
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  font: 13px/1.5 system-ui;
}
button {
  padding: 6px 10px;
  border: 1px solid var(--pt-line);
  background: var(--pt-panel);
  color: var(--pt-ink);
  border-radius: 4px;
  cursor: pointer;
}
section {
  width: min(650px, calc(100vw - 32px));
  max-height: 70dvh;
  overflow: auto;
  padding: 12px;
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}
h2 {
  font-size: 15px;
}
details {
  margin-top: 12px;
  border-top: 1px solid var(--pt-line);
  padding-top: 12px;
}
summary {
  cursor: pointer;
}
h2,
h3 {
  font-weight: 700;
  margin: 10px 0 4px;
}
dd,
pre {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
dt {
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>

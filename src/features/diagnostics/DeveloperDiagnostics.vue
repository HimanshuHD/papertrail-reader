<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { version } from '../../../package.json'
import { diagnostics } from './recorder'
import { capabilities, startSampler } from './sampler'
import { downloadJson } from '../../services/file-download'
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const minimized = ref(false)
let lastOverhead: ReturnType<typeof startSampler>['overhead'] | null = null
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
}
function pause() {
  if (sampler) lastOverhead = { ...sampler.overhead }
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
  lastOverhead = null
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
        samplerOverhead: sampler?.overhead ?? lastOverhead,
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
      <h2>Developer diagnostics</h2>
      <button type="button" @click="minimize">Minimize diagnostics</button>
      <p>Local measurements · Ctrl+Alt+D · Escape closes and stops sampling.</p>
      <dl>
        <template v-for="(value, key) in identity" :key="key"
          ><dt>{{ key }}</dt>
          <dd>{{ value }}</dd></template
        >
      </dl>
      <p>Session {{ snapshot.session }} · {{ snapshot.running ? 'Sampling' : 'Paused' }}</p>
      <div class="actions">
        <button v-if="snapshot.running" @click="pause">Pause</button
        ><button v-else @click="resume">Resume</button><button @click="reset">Reset session</button
        ><button @click="exportSummary">Export local JSON</button
        ><button @click="toggle">Close diagnostics</button>
      </div>
      <h3>Capabilities</h3>
      <ul>
        <li v-for="(value, key) in available" :key="key">{{ key }}: {{ value }}</li>
      </ul>
      <h3>Owned resources</h3>
      <p>
        Tracked application resources only. Absent counters have no registered owner; they are not
        browser-wide totals.
      </p>
      <pre>{{ JSON.stringify(snapshot.resources, null, 2) }}</pre>
      <p>
        Pending {{ JSON.stringify(snapshot.pending) }} · Cancelled {{ snapshot.cancellations }} ·
        Dropped {{ snapshot.droppedTimings }}
      </p>
      <h3>Latest sample</h3>
      <pre>{{
        JSON.stringify(snapshot.samples.at(-1) ?? 'Unavailable: waiting for sample', null, 2)
      }}</pre>
      <h3>Recent lifecycle timings (ms)</h3>
      <ol>
        <li v-for="(timing, index) in snapshot.timings.slice(-20)" :key="index">
          {{ timing.metric }} · {{ timing.durationMs.toFixed(2) }} · {{ timing.outcome }}
        </li>
      </ol>
      <p>
        At most 120 timings/samples retained. Frame intervals are estimates, not universal FPS. Use
        browser Task Manager/process profiling and DevTools heap snapshots for full memory analysis.
      </p>
    </section>
  </aside>
</template>
<style scoped>
.developer-diagnostics {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  color: var(--color-ink, #202636);
  background: var(--color-surface, #fff);
  border: 1px solid #888;
  border-radius: 8px;
  font: 13px/1.5 system-ui;
}
button {
  padding: 6px 10px;
  border: 1px solid currentColor;
  border-radius: 4px;
  cursor: pointer;
}
section {
  width: min(470px, calc(100vw - 32px));
  max-height: 70dvh;
  overflow: auto;
  padding: 12px;
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

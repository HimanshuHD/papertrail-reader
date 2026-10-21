<script setup lang="ts">
import type { SensorSnapshot } from './responsiveness'
import DiagnosticTrend from './DiagnosticTrend.vue'
import { measurement } from './presentation'
defineProps<{ snapshot: SensorSnapshot; enabled: boolean }>()
defineEmits<{ toggle: [] }>()
</script>
<template>
  <section class="sensors" aria-label="Responsiveness and loading sensors">
    <h3>Responsiveness and loading</h3>
    <label class="sensor-toggle">
      <input type="checkbox" :checked="enabled" @change="$emit('toggle')" />
      Enable additional sensors (experimental)
    </label>
    <p>
      {{ snapshot.active ? 'Observing foreground activity' : 'Inactive · retained readings' }}.
      Opt-in pending workload overhead calibration. These readings do not change the health
      indicator.
    </p>
    <div class="sensor-cards">
      <article>
        <h4>Input delay · Event Timing</h4>
        <p>{{ snapshot.inputs.length }} retained eligible interactions · latest longest event</p>
        <dl>
          <dt>Waiting</dt>
          <dd>{{ measurement(snapshot.inputs.at(-1)?.waitMs) }}</dd>
          <dt>Handler</dt>
          <dd>{{ measurement(snapshot.inputs.at(-1)?.handlerMs) }}</dd>
          <dt>Interaction event duration</dt>
          <dd>{{ measurement(snapshot.inputs.at(-1)?.durationMs) }}</dd>
        </dl>
        <DiagnosticTrend
          :values="snapshot.inputs.map((row) => row.durationMs)"
          label="Retained eligible interaction durations, milliseconds; not page INP"
        />
        <p>{{ snapshot.capabilities.event }}</p>
      </article>
      <article>
        <h4>Long animation frames</h4>
        <p>{{ snapshot.frames.length }} retained frames · latest reading</p>
        <dl>
          <dt>Duration</dt>
          <dd>{{ measurement(snapshot.frames.at(-1)?.durationMs) }}</dd>
          <dt>Blocking</dt>
          <dd>{{ measurement(snapshot.frames.at(-1)?.blockingMs) }}</dd>
          <dt>Rendering phase</dt>
          <dd>{{ measurement(snapshot.frames.at(-1)?.renderingMs) }}</dd>
          <dt>Style/layout phase</dt>
          <dd>{{ measurement(snapshot.frames.at(-1)?.styleLayoutMs) }}</dd>
          <dt>Attributed forced layout</dt>
          <dd>{{ measurement(snapshot.frames.at(-1)?.forcedLayoutMs) }}</dd>
        </dl>
        <DiagnosticTrend
          :values="snapshot.frames.map((row) => row.durationMs)"
          label="Retained long animation frame durations, milliseconds"
        />
        <p>{{ snapshot.capabilities['long-animation-frame'] }}</p>
      </article>
      <article>
        <h4>Resource loading · Resource Timing</h4>
        <p>{{ snapshot.resources.length }} retained resources · latest reading</p>
        <dl>
          <dt>Category</dt>
          <dd>{{ snapshot.resources.at(-1)?.category ?? 'Unavailable' }}</dd>
          <dt>Load duration</dt>
          <dd>{{ measurement(snapshot.resources.at(-1)?.durationMs) }}</dd>
          <dt>Transfer size</dt>
          <dd>{{ measurement(snapshot.resources.at(-1)?.transferBytes, 'bytes') }}</dd>
        </dl>
        <p>{{ snapshot.capabilities.resource }}</p>
        <p>
          Zero transfer does not prove a cache hit. Cross-origin timing can be restricted. This is
          not local document read latency.
        </p>
      </article>
    </div>
    <p>
      Current frame only; iframe/worker coverage is partial. Thresholded, rounded events are not
      page INP. Long frames overlap Long Tasks and are not summed into a score. Scope and observer
      callback overhead are available in Technical details and JSON.
    </p>
  </section>
</template>
<style scoped>
.sensors {
  margin-top: 16px;
  border-top: 1px solid var(--pt-border);
  padding-top: 12px;
}
.sensor-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sensor-toggle input {
  width: 16px;
  height: 16px;
}
.sensor-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 10px;
}
article {
  border: 1px solid var(--pt-border);
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}
h4 {
  margin: 0;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 8px;
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
p {
  color: var(--pt-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>

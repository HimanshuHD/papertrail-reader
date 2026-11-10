<script setup lang="ts">
import { computed } from 'vue'
import { measurement } from './presentation'
const props = defineProps<{ values: number[]; label: string }>()
const ceiling = computed(() => Math.max(1, ...props.values) * 1.15)
const points = computed(() =>
  props.values
    .map(
      (value, index) =>
        `${props.values.length > 1 ? (index / (props.values.length - 1)) * 100 : 50},${40 - (value / ceiling.value) * 36}`,
    )
    .join(' '),
)
</script>
<template>
  <div class="sensor-trend">
    <div class="scale" aria-hidden="true">
      <span>{{ Math.ceil(ceiling) }}</span
      ><span>0</span>
    </div>
    <div>
      <svg
        viewBox="0 0 100 42"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${label}. ${values.length} retained observations, milliseconds. ${values.length ? `Maximum ${measurement(Math.max(...values))}. Latest ${measurement(values.at(-1))}.` : 'No available readings.'}`"
      >
        <polyline v-if="values.length" :points="points" />
      </svg>
      <div class="axis" aria-hidden="true"><span>Earlier</span><span>Latest observation</span></div>
    </div>
  </div>
</template>
<style scoped>
.sensor-trend {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 4px;
  margin: 12px 0;
}
.scale {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: right;
  padding-bottom: 20px;
}
.scale,
.axis {
  color: var(--pt-muted);
  font-size: 11px;
}
svg {
  width: 100%;
  height: 72px;
  border-bottom: 1px solid var(--pt-line);
  overflow: visible;
}
polyline {
  fill: none;
  stroke: var(--pt-brand);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.axis {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>

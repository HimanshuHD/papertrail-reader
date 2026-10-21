<script setup lang="ts">
import { computed } from 'vue'
import { trendSegments } from './presentation'
const props = defineProps<{ values: (number | null)[]; label: string }>()
const segments = computed(() => trendSegments(props.values))
const description = computed(() => {
  const values = props.values.filter(
    (value): value is number => value !== null && Number.isFinite(value) && value >= 0,
  )
  if (!values.length) return `${props.label}. No available readings.`
  const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return `${props.label}. ${values.length} available readings. Minimum ${format(Math.min(...values))}; maximum ${format(Math.max(...values))}.`
})
</script>
<template>
  <svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" :aria-label="description">
    <title>{{ description }}</title>
    <polyline v-for="(points, index) in segments" :key="index" :points="points" />
  </svg>
</template>
<style scoped>
svg {
  width: 100%;
  height: 44px;
  overflow: visible;
}
polyline {
  fill: none;
  stroke: var(--pt-brand);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
</style>

<script setup lang="ts">
import UiIcon from './UiIcon.vue'
defineProps<{
  label: string
  icon: 'refresh' | 'plus' | 'close' | 'library'
  disabled?: boolean
  tooltipAbove?: boolean
}>()
</script>
<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    class="icon-button relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
  >
    <UiIcon :name="icon" />
    <span
      aria-hidden="true"
      class="icon-tooltip pointer-events-none absolute z-50 w-max max-w-48 rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium text-ink shadow-md"
      :class="tooltipAbove ? 'bottom-full left-0 mb-1' : 'top-full right-0 mt-1'"
      >{{ label }}</span
    >
  </button>
</template>
<style scoped>
.icon-tooltip {
  visibility: hidden;
}
.icon-button:hover .icon-tooltip,
.icon-button:focus-visible .icon-tooltip {
  visibility: visible;
}
</style>

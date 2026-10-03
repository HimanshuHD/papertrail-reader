<script setup lang="ts">
import UiIcon from './UiIcon.vue'
defineProps<{
  label: string
  icon:
    | 'refresh'
    | 'plus'
    | 'close'
    | 'library'
    | 'previous'
    | 'next'
    | 'zoom-out'
    | 'zoom-in'
    | 'fit-width'
    | 'fit-page'
    | 'bookmark'
    | 'contents'
    | 'search'
    | 'fullscreen'
    | 'fullscreen-exit'
    | 'help'
  disabled?: boolean
  tooltipAlign?: 'start' | 'end'
  active?: boolean
}>()
</script>
<template>
  <button
    type="button"
    :aria-label="label"
    :disabled="disabled"
    class="icon-button relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
    :class="{ 'bg-canvas text-brand': active }"
  >
    <UiIcon :name="icon" />
    <span
      aria-hidden="true"
      class="icon-tooltip pointer-events-none absolute z-50 w-max max-w-48 rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium text-ink shadow-lg top-full mt-2"
      :class="tooltipAlign === 'start' ? 'left-0' : 'right-0'"
      >{{ label }}</span
    >
  </button>
</template>
<style scoped>
.icon-tooltip {
  visibility: hidden;
  opacity: 0;
  transform: translateY(-0.25rem);
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    visibility 180ms;
}
.icon-button:hover .icon-tooltip,
.icon-button:focus-visible .icon-tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .icon-tooltip {
    transition: none;
  }
}
</style>

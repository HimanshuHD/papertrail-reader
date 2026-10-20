<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import AccessibleTooltip from './AccessibleTooltip.vue'
import { ref, useId } from 'vue'
const button = ref<HTMLButtonElement | null>(null)
const tooltipOpen = ref(false)
const tooltipId = useId()
defineProps<{
  label: string
  icon:
    | 'refresh'
    | 'plus'
    | 'more'
    | 'close'
    | 'library'
    | 'previous'
    | 'next'
    | 'zoom-out'
    | 'zoom-in'
    | 'fit-width'
    | 'fit-page'
    | 'two-page'
    | 'compare'
    | 'annotations'
    | 'bookmark'
    | 'contents'
    | 'typography'
    | 'search'
    | 'fullscreen'
    | 'fullscreen-exit'
    | 'clock'
    | 'help'
  disabled?: boolean
  tooltipAlign?: 'start' | 'end'
  active?: boolean
}>()
</script>
<template>
  <button
    ref="button"
    type="button"
    :aria-describedby="tooltipOpen ? tooltipId : undefined"
    :aria-label="label"
    :disabled="disabled"
    :data-active="active || undefined"
    class="icon-button relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
    :class="{
      'bg-canvas text-brand': active,
    }"
    @mouseenter="tooltipOpen = true"
    @mouseleave="tooltipOpen = false"
    @focus="tooltipOpen = true"
    @blur="tooltipOpen = false"
    @click="tooltipOpen = false"
  >
    <UiIcon :name="icon" />
    <AccessibleTooltip
      :id="tooltipId"
      :anchor="button"
      :open="tooltipOpen"
      :text="label"
      @dismiss="tooltipOpen = false"
    />
  </button>
</template>

<style scoped>
.icon-button:focus-visible {
  outline-offset: -2px;
}
</style>

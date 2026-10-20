<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { claimTooltip, releaseTooltip } from '../composables/tooltip-owner'
import { useOverlayTarget } from '../composables/useOverlayTarget'
const props = defineProps<{
  anchor: HTMLElement | null
  text: string
  open: boolean
  id?: string
}>()
const emit = defineEmits<{ dismiss: [] }>()
const fallbackId = useId()
const owner = Symbol()
const target = useOverlayTarget()
const popup = ref<HTMLElement | null>(null)
const position = ref({ left: '8px', top: '8px', visibility: 'hidden' as 'visible' | 'hidden' })
async function place() {
  await nextTick()
  if (!props.open || !props.anchor || !popup.value) return
  if (props.anchor.closest('[inert]:not([inert="false"]), [aria-hidden="true"]')) {
    dismiss()
    return
  }
  const a = props.anchor.getBoundingClientRect(),
    b = popup.value.getBoundingClientRect()
  position.value = {
    left: `${Math.max(8, Math.min(a.left + a.width / 2 - b.width / 2, innerWidth - b.width - 8))}px`,
    top: `${a.bottom + 8 + b.height <= innerHeight - 8 ? a.bottom + 8 : Math.max(8, a.top - b.height - 8)}px`,
    visibility: 'visible',
  }
}
function dismiss() {
  emit('dismiss')
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') dismiss()
}
watch(
  () => [props.open, props.anchor, props.text],
  () => {
    position.value.visibility = 'hidden'
    if (props.open) {
      claimTooltip(owner, dismiss)
      void place()
    } else releaseTooltip(owner)
  },
  { immediate: true, flush: 'post' },
)
watch(
  () => props.open,
  (open) => {
    window.removeEventListener('scroll', place, true)
    window.removeEventListener('resize', place)
    window.removeEventListener('keydown', key)
    if (open) {
      window.addEventListener('scroll', place, true)
      window.addEventListener('resize', place)
      window.addEventListener('keydown', key)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  releaseTooltip(owner)
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
  window.removeEventListener('keydown', key)
})
</script>
<template>
  <Teleport :to="target">
    <span
      v-if="open && anchor"
      :id="id ?? fallbackId"
      ref="popup"
      role="tooltip"
      class="accessible-tooltip"
      :style="position"
      >{{ text }}</span
    >
  </Teleport>
</template>
<style scoped>
.accessible-tooltip {
  position: fixed;
  z-index: 200;
  pointer-events: none;
  max-width: min(22rem, calc(100vw - 16px));
  overflow-wrap: anywhere;
  border: 1px solid var(--pt-line);
  border-radius: 6px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  box-shadow: 0 3px 10px #0002;
}
</style>

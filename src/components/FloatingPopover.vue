<script setup lang="ts">
import { useOverlayTarget } from '../composables/useOverlayTarget'
const overlayTarget = useOverlayTarget()
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ anchor: HTMLElement | null; expanded?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const root = ref<HTMLElement | null>(null)
const position = ref({ left: '8px', top: '8px', visibility: 'hidden' as 'hidden' | 'visible' })
let observer: ResizeObserver | undefined
const frameDocuments = new Set<Document>()
function place() {
  const anchor = props.anchor?.getBoundingClientRect(),
    popup = root.value
  if (!anchor || !popup) return
  const width = popup.offsetWidth,
    height = popup.offsetHeight
  const below = anchor.bottom + 8
  const top = below + height <= innerHeight - 8 ? below : anchor.top - height - 8
  position.value = {
    left: Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8)) + 'px',
    top: Math.max(8, Math.min(top, innerHeight - height - 8)) + 'px',
    visibility: 'visible',
  }
}
function outside(event: Event) {
  const target = event.target as Node
  if (!root.value?.contains(target) && !props.anchor?.contains(target)) emit('close')
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    event.preventDefault()
    emit('close')
    props.anchor?.focus({ preventScroll: true })
  }
}
function scroll(event: Event) {
  if (!root.value?.contains(event.target as Node)) emit('close')
}
onMounted(async () => {
  await nextTick()
  if (!root.value) return
  place()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(place)
    if (root.value) observer.observe(root.value)
  }
  for (const frame of document.querySelectorAll('iframe')) {
    try {
      if (frame.contentDocument) {
        frameDocuments.add(frame.contentDocument)
        frame.contentDocument.addEventListener('pointerdown', outside, true)
        frame.contentDocument.addEventListener('keydown', key, true)
      }
    } catch {
      /* An external frame cannot be inspected. */
    }
  }
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', key, true)
  document.addEventListener('scroll', scroll, true)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  for (const doc of frameDocuments) {
    doc.removeEventListener('pointerdown', outside, true)
    doc.removeEventListener('keydown', key, true)
  }
  frameDocuments.clear()
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', key, true)
  document.removeEventListener('scroll', scroll, true)
  window.removeEventListener('resize', place)
})
watch(
  () => props.expanded,
  async () => {
    await nextTick()
    place()
  },
)
</script>
<template>
  <Teleport :to="overlayTarget">
    <div
      ref="root"
      class="floating-popover"
      :class="{ expanded }"
      :style="position"
      @pointerdown.stop
    >
      <slot />
    </div>
  </Teleport>
</template>
<style scoped>
.floating-popover {
  position: fixed;
  z-index: 100;
  width: min(290px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--pt-ink) 35%, var(--pt-line));
  border-radius: 14px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  box-shadow:
    0 20px 56px #0007,
    0 6px 18px #0004,
    0 0 0 1px var(--pt-line);
}
.expanded {
  width: min(380px, calc(100vw - 16px));
}
</style>

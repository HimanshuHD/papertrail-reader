<script setup lang="ts">
import { hideTransitionSurface, restoreTransitionSurface } from '../../services/transition-surface'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ sidebarOpen: boolean; initialWidth?: number }>()
const emit = defineEmits<{ close: []; widthChange: [width: number] }>()
const root = ref<HTMLElement | null>(null)
const width = ref(props.initialWidth ?? 308)
const hostWidth = ref(1024)
const dragging = ref(false)
const maxWidth = computed(() =>
  Math.max(
    160,
    Math.min(600, hostWidth.value >= 1024 ? hostWidth.value - 360 : hostWidth.value * 0.9),
  ),
)
const minWidth = computed(() => Math.min(240, maxWidth.value))
let observer: ResizeObserver | null = null
function setWidth(value: number) {
  const next = Math.round(Math.max(minWidth.value, Math.min(maxWidth.value, value)))
  if (next !== width.value) {
    width.value = next
    emit('widthChange', next)
  }
}
watch(
  () => props.initialWidth,
  (value) => {
    if (value !== undefined) setWidth(value)
  },
)
function measure() {
  hostWidth.value = root.value?.clientWidth || window.innerWidth
  setWidth(width.value)
}
function startResize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function resize(event: PointerEvent) {
  if (dragging.value && root.value)
    setWidth(event.clientX - root.value.getBoundingClientRect().left)
}
function finishResize() {
  dragging.value = false
}
function resizeKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 4 : 16
  if (event.key === 'ArrowRight') setWidth(width.value + step)
  else if (event.key === 'ArrowLeft') setWidth(width.value - step)
  else if (event.key === 'Home') setWidth(minWidth.value)
  else if (event.key === 'End') setWidth(maxWidth.value)
  else return
  event.preventDefault()
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(measure)
    observer.observe(root.value)
  }
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<template>
  <div
    ref="root"
    :class="['reader-layout', { 'sidebar-visible': sidebarOpen, resizing: dragging }]"
    :style="{ '--library-width': `${width}px` }"
  >
    <div v-if="!sidebarOpen" class="library-opener"><slot name="opener" /></div>
    <Transition
      name="library-slide"
      @before-enter="restoreTransitionSurface"
      @before-leave="hideTransitionSurface"
    >
      <aside
        v-if="sidebarOpen"
        id="document-sidebar"
        class="library-scroll border-line bg-panel"
        aria-label="Document library"
        tabindex="0"
        @keydown.esc.stop="$emit('close')"
      >
        <slot name="sidebar" />
      </aside>
    </Transition>
    <div
      v-if="sidebarOpen"
      class="library-resize"
      role="separator"
      aria-label="Resize library panel"
      aria-orientation="vertical"
      :aria-valuemin="Math.round(minWidth)"
      :aria-valuemax="Math.round(maxWidth)"
      :aria-valuenow="width"
      tabindex="0"
      @pointerdown="startResize"
      @pointermove="resize"
      @pointerup="finishResize"
      @pointercancel="finishResize"
      @lostpointercapture="finishResize"
      @keydown="resizeKey"
    ></div>
    <div :class="['reader-column', { 'opener-visible': !sidebarOpen }]">
      <slot name="toolbar" />
      <div class="reader-content"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.reader-layout {
  position: relative;
  display: grid;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  grid-template-columns: 0 minmax(0, 1fr);
  transition: grid-template-columns 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.library-opener {
  position: absolute;
  left: 12px;
  top: 16px;
  z-index: 30;
}
.library-opener :deep(button) {
  cursor: pointer;
  color: var(--pt-brand);
  border-color: var(--pt-brand);
  transition:
    background-color 150ms,
    transform 150ms,
    box-shadow 150ms;
}
.library-opener :deep(button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgb(0 0 0 / 16%);
}
.library-scroll {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 30;
  width: var(--library-width);
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--pt-line);
  box-shadow: 12px 0 24px rgb(0 0 0 / 12%);
}
.library-resize {
  position: absolute;
  left: calc(var(--library-width) - 4px);
  top: 0;
  bottom: 0;
  width: 8px;
  z-index: 45;
  cursor: col-resize;
  touch-action: none;
  border-radius: 4px;
}
.library-resize:hover,
.library-resize:focus-visible,
.resizing .library-resize {
  background: var(--pt-brand);
}
.resizing {
  user-select: none;
  transition: none;
}
.reader-column {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.opener-visible :deep(.pdf-header),
.opener-visible :deep(.sample-toolbar) {
  padding-left: 76px;
}
.opener-visible :deep(.epub-heading) {
  padding-left: 64px;
}
@media (max-width: 1023px) {
  .opener-visible :deep(.reader-welcome) {
    padding-left: 76px;
  }
}
.reader-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.library-slide-enter-active,
.library-slide-leave-active {
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.library-slide-enter-from,
.library-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
@media (min-width: 1024px) {
  .reader-layout.sidebar-visible {
    grid-template-columns: var(--library-width) minmax(0, 1fr);
  }
  .library-scroll {
    box-shadow: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reader-layout,
  .library-slide-enter-active,
  .library-slide-leave-active,
  .library-opener :deep(button) {
    transition: none;
  }
  .library-opener :deep(button:hover) {
    transform: none;
  }
}
</style>

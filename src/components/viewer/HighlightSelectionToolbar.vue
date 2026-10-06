<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import UiIcon from '../UiIcon.vue'
import type { AnnotationColor } from '../../services/annotation-storage'
import { toolbarPosition, type SelectionAnchor } from '../../features/annotations/selection-toolbar'
const props = defineProps<{ format: 'PDF' | 'EPUB'; anchor: SelectionAnchor; disabled: boolean }>()
const emit = defineEmits<{ highlight: [color?: AnnotationColor]; note: [] }>()
const root = ref<HTMLElement | null>(null)
const size = ref({ width: 320, height: 48 })
onMounted(async () => {
  await nextTick()
  if (root.value) size.value = { width: root.value.offsetWidth, height: root.value.offsetHeight }
})
const position = computed(() =>
  toolbarPosition(
    props.anchor,
    size.value.width,
    size.value.height,
    globalThis.innerWidth,
    globalThis.innerHeight,
  ),
)
const colors: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink']
</script>
<template>
  <div
    ref="root"
    class="selection-toolbar"
    :aria-label="`${format} highlights`"
    role="group"
    :style="{ left: position.left + 'px', top: position.top + 'px' }"
    @pointerdown.prevent
  >
    <button
      v-for="color in colors"
      :key="color"
      type="button"
      class="color-action"
      :aria-label="`Highlight ${color}`"
      :title="`Highlight ${color}`"
      :disabled="disabled"
      @click="emit('highlight', color)"
    >
      <span class="color-swatch" :class="`swatch-${color}`" />
    </button>
    <span class="toolbar-divider" />
    <button
      type="button"
      class="toolbar-action"
      aria-label="Highlight selection"
      title="Highlight selection"
      :disabled="disabled"
      @click="emit('highlight')"
    >
      <UiIcon name="highlight" />
    </button>
    <span class="toolbar-divider" />
    <button
      type="button"
      class="toolbar-action note-action"
      :disabled="disabled"
      @click="emit('note')"
    >
      <UiIcon name="annotations" /><span>Add note</span>
    </button>
  </div>
</template>
<style scoped>
.selection-toolbar {
  position: fixed;
  z-index: 40;
  display: flex;
  align-items: center;
  padding: 5px 8px;
  max-width: calc(100vw - 16px);
  border: 1px solid var(--pt-line);
  border-radius: 16px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  box-shadow: 0 8px 24px #0003;
}
.toolbar-action,
.color-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  min-width: 34px;
  border-radius: 8px;
}
.note-action {
  padding: 0 8px;
  white-space: nowrap;
  font-size: 14px;
}
.toolbar-action:hover,
.color-action:hover {
  background: var(--pt-canvas);
}
.toolbar-action:focus-visible,
.color-action:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
button:disabled {
  opacity: 0.4;
}
.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #0002;
}
.swatch-yellow {
  background: #ffe58a;
}
.swatch-green {
  background: #a9dfbf;
}
.swatch-blue {
  background: #a4d9f5;
}
.swatch-pink {
  background: #efb2d0;
}
.toolbar-divider {
  height: 22px;
  width: 1px;
  margin: 0 5px;
  background: var(--pt-line);
}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import UiIcon from '../UiIcon.vue'
import type { AnnotationColor } from '../../services/annotation-storage'
import { ANNOTATION_LIMITS } from '../../features/annotations/selectors'
import { toolbarPosition, type SelectionAnchor } from '../../features/annotations/selection-toolbar'
const props = defineProps<{
  format: 'PDF' | 'EPUB'
  anchor: SelectionAnchor
  disabled: boolean
  saved?: boolean
  notice?: string
  retryable?: boolean
}>()
const emit = defineEmits<{
  highlight: [color: AnnotationColor, keepOpen: boolean]
  saveNote: [note: string, color: AnnotationColor]
  retry: []
  color: [color: AnnotationColor]
}>()
const root = ref<HTMLElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)
const noteButton = ref<HTMLButtonElement | null>(null)
const size = ref({ width: 320, height: 48 })
const editing = ref(false)
const draft = ref('')
const color = ref<AnnotationColor>('yellow')
let observer: ResizeObserver | undefined
function measure() {
  if (root.value)
    size.value = { width: root.value.offsetWidth || 320, height: root.value.offsetHeight || 48 }
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (root.value) observer.observe(root.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(editing, async () => {
  await nextTick()
  measure()
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
const tooltipPosition = computed(() => ({
  left: position.value.left + 'px',
  top:
    Math.max(
      8,
      Math.min(
        position.value.top > 48
          ? position.value.top - 40
          : position.value.top + size.value.height + 8,
        globalThis.innerHeight - 40,
      ),
    ) + 'px',
}))
const colors: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink']
async function openNote() {
  editing.value = true
  await nextTick()
  textarea.value?.focus({ preventScroll: true })
}
async function cancelNote() {
  draft.value = ''
  editing.value = false
  await nextTick()
  noteButton.value?.focus({ preventScroll: true })
}
function pickColor(next: AnnotationColor) {
  color.value = next
  emit('color', next)
}
function submitNote() {
  if (!props.disabled && draft.value.trim() && draft.value.length <= ANNOTATION_LIMITS.note)
    emit('saveNote', draft.value, color.value)
}
function preserveSelection(event: PointerEvent) {
  if (!(event.target instanceof Element) || !event.target.closest('textarea'))
    event.preventDefault()
}
</script>
<template>
  <div
    ref="root"
    class="selection-toolbar"
    :class="{ 'composer-open': editing }"
    :aria-label="`${format} highlights`"
    role="group"
    :style="{ left: position.left + 'px', top: position.top + 'px' }"
    @pointerdown="preserveSelection"
    @keydown.esc.stop.prevent="cancelNote"
  >
    <div class="highlight-controls">
      <button
        v-for="shade in colors"
        :key="shade"
        type="button"
        class="color-action"
        :aria-label="`Highlight ${shade}`"
        :aria-pressed="color === shade"
        :title="`Highlight ${shade}`"
        :disabled="disabled"
        @click="pickColor(shade)"
      >
        <span class="color-swatch" :class="`swatch-${shade}`" />
      </button>
      <span class="toolbar-divider" />
      <button
        type="button"
        class="toolbar-action highlight-action"
        aria-label="Add highlight"
        :disabled="disabled || saved"
        @click="emit('highlight', color, editing)"
      >
        <UiIcon name="highlight" /><span
          role="tooltip"
          class="highlight-tooltip"
          :style="tooltipPosition"
          >Add highlight</span
        >
      </button>
      <span class="toolbar-divider" />
      <button
        ref="noteButton"
        type="button"
        class="toolbar-action note-action"
        aria-label="Add note"
        :disabled="disabled"
        @click="openNote"
      >
        <UiIcon name="note" /><span>Add note</span>
      </button>
    </div>
    <Transition name="note-expand" @after-enter="measure" @after-leave="measure">
      <form v-if="editing" class="note-composer" @submit.prevent="submitNote">
        <div class="composer-heading">
          <button
            type="button"
            class="toolbar-action"
            aria-label="Back to highlight controls"
            :disabled="disabled"
            @click="cancelNote"
          >
            <UiIcon name="previous" /></button
          ><label :for="`${format.toLowerCase()}-selection-note`">Add note</label>
        </div>
        <textarea
          :id="`${format.toLowerCase()}-selection-note`"
          ref="textarea"
          v-model="draft"
          rows="3"
          placeholder="Write your note…"
          :maxlength="ANNOTATION_LIMITS.note"
          :disabled="disabled"
        />
        <p v-if="notice" class="composer-status" role="status">
          {{ notice }}
          <button v-if="retryable" type="button" class="underline" @click="emit('retry')">
            Retry annotations
          </button>
        </p>
        <div class="composer-footer">
          <span class="composer-count">{{ draft.length }} / {{ ANNOTATION_LIMITS.note }}</span
          ><button type="button" class="composer-cancel" :disabled="disabled" @click="cancelNote">
            Cancel</button
          ><button
            type="submit"
            class="composer-save pt-button-filled"
            :disabled="disabled || !draft.trim() || draft.length > ANNOTATION_LIMITS.note"
          >
            {{ saved ? 'Save note' : 'Save highlight with note' }}
          </button>
        </div>
      </form>
    </Transition>
  </div>
</template>
<style scoped>
.selection-toolbar {
  position: fixed;
  z-index: 40;
  padding: 12px;
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  border: 1px solid color-mix(in srgb, var(--pt-ink) 35%, var(--pt-line));
  border-radius: 16px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  box-shadow:
    0 18px 48px #0006,
    0 4px 12px #0003;
  transition:
    top 180ms ease,
    width 180ms ease;
}
.composer-open {
  width: min(400px, calc(100vw - 16px));
}
.highlight-controls {
  display: flex;
  align-items: center;
}
.toolbar-action,
.color-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  min-width: 32px;
  border-radius: 8px;
}
.note-action {
  padding: 0 6px;
  white-space: nowrap;
  font-size: 14px;
}
.toolbar-action:hover,
.color-action:hover {
  background: var(--pt-canvas);
}
button:focus-visible,
textarea:focus-visible {
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
.color-action[aria-pressed='true'] .color-swatch {
  outline: 1px solid var(--pt-ink);
  outline-offset: 2px;
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
.highlight-tooltip {
  position: fixed;
  width: max-content;
  padding: 6px 10px;
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  background: var(--pt-panel);
  font-size: 12px;
  pointer-events: none;
  visibility: hidden;
}
.highlight-action:hover .highlight-tooltip,
.highlight-action:focus-visible .highlight-tooltip {
  visibility: visible;
}
.note-composer {
  padding: 16px 0 0;
  border-top: 1px solid var(--pt-line);
  margin-top: 12px;
  overflow: hidden;
}
.composer-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  margin-bottom: 12px;
}
textarea {
  display: block;
  width: 100%;
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  background: var(--pt-canvas);
  color: var(--pt-ink);
  padding: 10px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  max-height: 30vh;
  min-height: 100px;
  max-height: 30vh;
}
.composer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.composer-cancel,
.composer-save {
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--pt-line);
  border-radius: 8px;
  font-size: 13px;
}
.composer-save {
  background: var(--pt-brand);
  color: var(--pt-canvas);
}
.composer-count,
.composer-status {
  font-size: 11px;
  color: var(--pt-muted);
}
.composer-count {
  margin-right: auto;
}
.note-expand-enter-active,
.note-expand-leave-active {
  transition:
    max-height 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
  max-height: 420px;
}
.note-expand-enter-from,
.note-expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .selection-toolbar,
  .note-expand-enter-active,
  .note-expand-leave-active {
    transition: none;
  }
}
</style>

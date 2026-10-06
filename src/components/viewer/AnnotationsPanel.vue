<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Annotation, AnnotationColor } from '../../services/annotation-storage'
import UiIcon from '../UiIcon.vue'
import { ANNOTATION_LIMITS } from '../../features/annotations/selectors'

const props = defineProps<{
  format: 'PDF' | 'EPUB'
  annotations: readonly Annotation[]
  selectedId: string
  unresolved: Readonly<Record<string, boolean>>
  available: boolean
  busy: boolean
  loading: boolean
  notice: string
  saveNote: (id: string, note: string) => Promise<boolean>
  recolor: (id: string, color: AnnotationColor) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}>()
const emit = defineEmits<{ navigate: [id: string]; retry: [] }>()
const root = ref<HTMLElement | null>(null)
const filterInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const colorFilter = ref<AnnotationColor | ''>('')
const notesOnly = ref(false)
const noteInput = ref<HTMLTextAreaElement | null>(null)
let pendingEditorFocus: string | null = null
const draft = ref('')
const editing = ref(false)
const prefix = computed(() => props.format.toLowerCase() + '-annotations')
const selected = computed(() => props.annotations.find((item) => item.id === props.selectedId))
const colors: Record<AnnotationColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
}
function quote(item: Annotation) {
  return item.selector.format === 'PDF'
    ? item.selector.segments.map((segment) => segment.text.exact).join(' ')
    : item.selector.text.exact
}
function location(item: Annotation) {
  return item.selector.format === 'PDF'
    ? `Page ${item.selector.segments[0]!.page}`
    : `Chapter ${item.selector.chapter + 1}`
}
const filtered = computed(() => {
  const text = query.value.trim().toLocaleLowerCase()
  return props.annotations.filter(
    (item) =>
      (!colorFilter.value || item.color === colorFilter.value) &&
      (!notesOnly.value || !!item.note.trim()) &&
      (!text || `${location(item)} ${quote(item)} ${item.note}`.toLocaleLowerCase().includes(text)),
  )
})
const dirty = computed(() => !!selected.value && draft.value !== selected.value.note)
const tooLong = computed(() => draft.value.length > ANNOTATION_LIMITS.note)
watch(
  () => props.selectedId,
  () => {
    draft.value = selected.value?.note ?? ''
  },
  { immediate: true },
)
// A failed save keeps its draft; refreshed colors must not overwrite unsaved note edits.
watch(selected, (item, previous) => {
  if (!item) draft.value = ''
  else if (draft.value === previous?.note) draft.value = item.note
})
onMounted(() => filterInput.value?.focus({ preventScroll: true }))
async function focusEditor() {
  await nextTick()
  if (!pendingEditorFocus || props.busy || props.loading) return
  const id = pendingEditorFocus
  pendingEditorFocus = null
  if (props.selectedId !== id || !props.available || !root.value || !noteInput.value) return
  root.value.scrollTop +=
    noteInput.value.getBoundingClientRect().top - root.value.getBoundingClientRect().top - 16
  noteInput.value.focus({ preventScroll: true })
}
function selectAnnotation(id: string) {
  pendingEditorFocus = null
  emit('navigate', id)
  void focusEditor()
}
function editNote(id: string) {
  editing.value = true
  pendingEditorFocus = id
  if (props.selectedId !== id) emit('navigate', id)
  else draft.value = selected.value?.note ?? ''
  void focusEditor()
}
defineExpose({ editNote })
watch(() => [props.busy, props.loading, props.selectedId], focusEditor)
async function focusList(id?: string) {
  await nextTick()
  const button = id
    ? root.value?.querySelector<HTMLButtonElement>(`[data-annotation-id="${id}"]`)
    : null
  const target = button ?? filterInput.value
  target?.focus({ preventScroll: true })
}
async function submitNote() {
  const item = selected.value
  if (!item || tooLong.value || !props.available || props.busy) return
  // Keep the draft until storage refreshes the committed record, including failed saves.
  await props.saveNote(item.id, draft.value)
}
async function clearNote() {
  const item = selected.value
  if (!item || !props.available || props.busy) return
  if ((await props.saveNote(item.id, '')) && props.selectedId === item.id) draft.value = ''
}
async function deleteAnnotation() {
  const item = selected.value
  if (item && (await props.remove(item.id))) await focusList()
}
function cancelEdit() {
  draft.value = selected.value?.note ?? ''
  void focusList(selected.value?.id)
}
</script>

<template>
  <section
    ref="root"
    class="annotation-panel min-h-0 flex-1 overflow-auto overscroll-contain p-5"
    :aria-labelledby="`${prefix}-title`"
  >
    <h3 :id="`${prefix}-title`" class="sr-only">Annotations ({{ annotations.length }})</h3>
    <p v-if="loading" role="status" class="mb-3 text-sm text-muted">Loading annotations…</p>
    <p v-if="notice" role="status" aria-live="polite" class="mb-3 text-sm text-muted">
      {{ notice }}
    </p>
    <button
      v-if="!available && !loading"
      type="button"
      class="annotation-button mb-3"
      :disabled="busy"
      @click="emit('retry')"
    >
      Retry annotations
    </button>
    <div class="mb-4 space-y-2">
      <label :for="`${prefix}-filter`" class="sr-only">Find annotations</label>
      <input
        :id="`${prefix}-filter`"
        ref="filterInput"
        v-model="query"
        type="search"
        maxlength="200"
        placeholder="Search highlights and notes"
        class="annotation-input"
      />
      <details class="annotation-filters text-xs text-muted">
        <summary class="cursor-pointer py-1">
          Filters<span v-if="colorFilter || notesOnly"> · active</span>
        </summary>
        <label :for="`${prefix}-color-filter`" class="sr-only">Filter by highlight color</label>
        <select :id="`${prefix}-color-filter`" v-model="colorFilter" class="annotation-input">
          <option value="">All colors</option>
          <option v-for="(label, color) in colors" :key="color" :value="color">{{ label }}</option>
        </select>
        <label class="flex items-center gap-2 text-xs">
          <input v-model="notesOnly" type="checkbox" />
          With notes only
        </label>
      </details>
    </div>
    <p v-if="!loading && !annotations.length" class="text-sm text-muted">
      Select text in the reader and save a highlight to add your first note.
    </p>
    <p v-else-if="!loading && !filtered.length" class="text-sm text-muted">
      No annotations match these filters.
    </p>
    <ul aria-label="Saved annotations">
      <li
        v-for="item in filtered"
        :key="item.id"
        class="annotation-row"
        :class="{ 'annotation-selected': selectedId === item.id }"
      >
        <span
          class="annotation-marker"
          :class="`marker-${item.color}`"
          :aria-label="colors[item.color]"
        />
        <div class="min-w-0 flex-1">
          <button
            type="button"
            :data-annotation-id="item.id"
            :aria-pressed="selectedId === item.id"
            :aria-label="`Go to annotation: ${location(item)} — ${quote(item).slice(0, 80)}`"
            :disabled="busy || loading"
            class="annotation-entry w-full text-left"
            @click="selectAnnotation(item.id)"
          >
            <span class="mb-2 block text-xs text-muted"
              >{{ location(item)
              }}<span v-if="unresolved[item.id]" class="ml-2 font-semibold">Unresolved</span></span
            >
            <span class="annotation-quote block">“{{ quote(item).slice(0, 240) }}”</span>
            <span v-if="item.note" class="annotation-note"
              ><UiIcon name="annotations" /><span class="whitespace-pre-wrap">{{
                item.note.slice(0, 240)
              }}</span></span
            >
          </button>
          <details class="annotation-menu">
            <summary :aria-label="`Actions for ${location(item)}`"><UiIcon name="more" /></summary>
            <div class="annotation-menu-content">
              <button
                type="button"
                class="annotation-button w-full text-left"
                :disabled="busy || loading"
                @click="editNote(item.id)"
              >
                {{ item.note ? 'Edit note' : 'Add note' }}
              </button>
              <label :for="`${prefix}-color-${item.id}`" class="block px-2 py-1 text-xs"
                >Highlight color</label
              >
              <select
                :id="`${prefix}-color-${item.id}`"
                :value="item.color"
                :disabled="!available || busy || loading"
                class="annotation-input"
                @change="
                  recolor(item.id, ($event.target as HTMLSelectElement).value as AnnotationColor)
                "
              >
                <option v-for="(label, color) in colors" :key="color" :value="color">
                  {{ label }}
                </option>
              </select>
              <button
                type="button"
                class="annotation-button mt-2 w-full text-left"
                :disabled="!available || busy || loading"
                @click="remove(item.id)"
              >
                Delete highlight and note
              </button>
            </div>
          </details>
        </div>
      </li>
    </ul>
    <form
      v-if="selected && editing"
      class="mt-4 space-y-3 border-t border-line pt-4"
      @submit.prevent="submitNote"
    >
      <p class="text-xs text-muted">{{ location(selected) }} · {{ colors[selected.color] }}</p>
      <label :for="`${prefix}-note`" class="block text-sm font-medium">Note</label>
      <textarea
        :id="`${prefix}-note`"
        ref="noteInput"
        v-model="draft"
        :maxlength="ANNOTATION_LIMITS.note"
        :disabled="!available || busy || loading"
        rows="5"
        class="annotation-input resize-y"
        :aria-describedby="`${prefix}-note-limit`"
      />
      <p :id="`${prefix}-note-limit`" class="text-xs text-muted">
        {{ draft.length }} / {{ ANNOTATION_LIMITS.note }} characters
        <span v-if="tooLong"> · Note is too long.</span>
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          class="annotation-button"
          :disabled="!available || busy || loading || !dirty || tooLong"
        >
          Save note
        </button>
        <button type="button" class="annotation-button" :disabled="busy" @click="cancelEdit">
          Cancel edit
        </button>
        <button
          type="button"
          class="annotation-button"
          :disabled="!available || busy || loading || !selected.note"
          @click="clearNote"
        >
          Delete note
        </button>
      </div>
      <label :for="`${prefix}-edit-color`" class="block text-xs font-medium">Highlight color</label>
      <select
        :id="`${prefix}-edit-color`"
        :value="selected.color"
        :disabled="!available || busy || loading"
        class="annotation-input"
        @change="
          recolor(selected.id, ($event.target as HTMLSelectElement).value as AnnotationColor)
        "
      >
        <option v-for="(label, color) in colors" :key="color" :value="color">{{ label }}</option>
      </select>
      <button
        type="button"
        class="annotation-button"
        :disabled="!available || busy || loading"
        @click="deleteAnnotation"
      >
        Delete highlight and note
      </button>
    </form>
  </section>
</template>

<style scoped>
.annotation-input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--pt-line);
  border-radius: 0.5rem;
  background: var(--pt-canvas);
  color: var(--pt-ink);
  padding: 0.625rem;
  font-size: 0.875rem;
}
.annotation-button {
  min-height: 36px;
  border: 1px solid var(--pt-line);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
}
.annotation-row {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 22px 26px 24px 0;
  border-bottom: 1px solid var(--pt-line);
}
.annotation-marker {
  flex: 0 0 7px;
  height: 42px;
  border-radius: 4px;
  margin-top: 2px;
}
.marker-yellow {
  background: #ffe58a;
}
.marker-green {
  background: #a9dfbf;
}
.marker-blue {
  background: #a4d9f5;
}
.marker-pink {
  background: #efb2d0;
}
.annotation-quote {
  font-family: Georgia, serif;
  font-size: 16px;
  line-height: 1.65;
}
.annotation-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 18px;
  font-size: 13px;
  line-height: 1.6;
}
.annotation-note svg {
  flex-shrink: 0;
}
.annotation-menu {
  position: absolute;
  right: 0;
  top: 20px;
}
.annotation-menu summary {
  list-style: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.annotation-menu summary::-webkit-details-marker {
  display: none;
}
.annotation-menu-content {
  position: absolute;
  z-index: 10;
  right: 0;
  top: 32px;
  width: 210px;
  padding: 10px;
  border: 1px solid var(--pt-line);
  border-radius: 10px;
  background: var(--pt-panel);
  box-shadow: 0 6px 16px #0002;
}
.annotation-entry:hover .annotation-quote {
  color: var(--pt-brand);
}
.annotation-selected .annotation-marker {
  outline: 2px solid var(--pt-brand);
  outline-offset: 3px;
}
.annotation-panel {
  overflow-wrap: anywhere;
}
.annotation-input:focus-visible,
.annotation-button:focus-visible,
.annotation-entry:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
.annotation-button:disabled,
.annotation-input:disabled,
.annotation-entry:disabled {
  opacity: 0.5;
}
</style>

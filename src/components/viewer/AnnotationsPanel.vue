<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Annotation, AnnotationColor } from '../../services/annotation-storage'
import FloatingPopover from '../FloatingPopover.vue'
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
const emit = defineEmits<{ navigate: [id: string]; select: [id: string]; retry: [] }>()
const root = ref<HTMLElement | null>(null)
const filterInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const colorFilter = ref<AnnotationColor | ''>('')
const notesOnly = ref(false)
const noteInput = ref<HTMLTextAreaElement | null>(null)
let pendingEditorFocus: string | null = null
const draft = ref('')
const editing = ref(false)
const menuId = ref('')
const menuAnchor = ref<HTMLElement | null>(null)
function closeMenu() {
  menuId.value = ''
  editing.value = false
  pendingEditorFocus = null
}
function openMenu(id: string, event: MouseEvent) {
  if (menuId.value === id) return closeMenu()
  menuId.value = id
  menuAnchor.value = event.currentTarget as HTMLElement
  editing.value = false
}
async function changeColor(id: string, color: AnnotationColor) {
  if ((await props.recolor(id, color)) && menuId.value === id) closeMenu()
}
async function deleteHighlight(id: string) {
  if ((await props.remove(id)) && menuId.value === id) closeMenu()
}
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
  noteInput.value.focus({ preventScroll: true })
}
function selectAnnotation(id: string) {
  closeMenu()
  emit('navigate', id)
  void focusEditor()
}
function editNote(id: string) {
  query.value = ''
  colorFilter.value = ''
  notesOnly.value = false
  menuId.value = id
  menuAnchor.value = root.value?.querySelector<HTMLElement>(`[data-menu-id="${id}"]`) ?? null
  editing.value = true
  pendingEditorFocus = id
  if (props.selectedId !== id) emit('select', id)
  draft.value = props.annotations.find((item) => item.id === id)?.note ?? ''
  void focusEditor()
}
async function revealAnnotation(id: string) {
  query.value = ''
  colorFilter.value = ''
  notesOnly.value = false
  editing.value = false
  await nextTick()
  const entry = root.value?.querySelector<HTMLButtonElement>(`[data-annotation-id="${id}"]`)
  if (entry && root.value)
    root.value.scrollTop +=
      entry.getBoundingClientRect().top - root.value.getBoundingClientRect().top - 16
  entry?.focus({ preventScroll: true })
}
defineExpose({ editNote, revealAnnotation })
watch(() => [props.busy, props.loading, props.selectedId], focusEditor)
async function submitNote() {
  const item = selected.value
  if (!item || tooLong.value || !props.available || props.busy) return
  // Keep the draft until storage refreshes the committed record, including failed saves.
  const submitted = draft.value
  if (await props.saveNote(item.id, submitted)) {
    if (props.selectedId === item.id && draft.value === submitted) closeMenu()
  }
}
async function clearNote() {
  const item = selected.value
  if (!item || !props.available || props.busy) return
  if ((await props.saveNote(item.id, '')) && props.selectedId === item.id) draft.value = ''
}
function cancelEdit() {
  draft.value = selected.value?.note ?? ''
  editing.value = false
  void nextTick(() => menuAnchor.value?.focus({ preventScroll: true }))
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
    <p v-if="notice && !available" role="status" aria-live="polite" class="mb-3 text-sm text-muted">
      {{ notice }}
    </p>
    <button
      v-if="!available && !loading"
      type="button"
      class="pt-framed-control annotation-button mb-3"
      :disabled="busy"
      @click="emit('retry')"
    >
      Retry annotations
    </button>
    <div class="annotation-filter-bar">
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
        <summary class="pt-text-action cursor-pointer py-1">
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
    <p v-if="!loading && !annotations.length" class="mt-4 text-sm text-muted">
      Select text in the reader and save a highlight to add your first note.
    </p>
    <p v-else-if="!loading && !filtered.length" class="mt-4 text-sm text-muted">
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
            class="annotation-entry pt-list-entry w-full text-left"
            @click="selectAnnotation(item.id)"
          >
            <span class="mb-2 block text-xs text-muted"
              >{{ location(item)
              }}<span v-if="unresolved[item.id]" class="ml-2 font-semibold">Unresolved</span></span
            >
            <span class="annotation-quote block"
              >“{{
                Array.from(quote(item)).slice(0, 100).join('') +
                (Array.from(quote(item)).length > 100 ? '...' : '')
              }}”</span
            >
            <span v-if="item.note" class="annotation-note"
              ><UiIcon name="note" /><span class="whitespace-pre-wrap">{{
                item.note.slice(0, 240)
              }}</span></span
            >
          </button>
          <div class="annotation-menu">
            <button
              type="button"
              :data-menu-id="item.id"
              :aria-label="`Actions for ${location(item)}`"
              :aria-expanded="menuId === item.id"
              @click="openMenu(item.id, $event)"
            >
              <UiIcon name="more" />
            </button>
            <FloatingPopover
              v-if="menuId === item.id"
              :anchor="menuAnchor"
              :expanded="editing"
              @close="closeMenu"
            >
              <form
                v-if="selected && editing && selected.id === item.id"
                class="space-y-3"
                @submit.prevent="submitNote"
              >
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="annotation-back"
                    aria-label="Back to annotation actions"
                    :disabled="busy"
                    @click="cancelEdit"
                  >
                    <UiIcon name="previous" /></button
                  ><span class="text-sm font-semibold">{{
                    selected.note ? 'Edit note' : 'Add note'
                  }}</span>
                </div>
                <label :for="`${prefix}-note`" class="block text-sm font-medium">Note</label>
                <textarea
                  :id="`${prefix}-note`"
                  :ref="(element) => (noteInput = element as HTMLTextAreaElement | null)"
                  v-model="draft"
                  :maxlength="ANNOTATION_LIMITS.note"
                  :disabled="!available || busy || loading"
                  rows="3"
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
                    class="pt-framed-control annotation-button pt-stable-border"
                    :disabled="!available || busy || loading || !dirty || tooLong"
                  >
                    <UiIcon name="check" />Save note
                  </button>
                  <button
                    type="button"
                    class="pt-framed-control annotation-button"
                    :disabled="busy"
                    @click="cancelEdit"
                  >
                    <UiIcon name="close" />Cancel
                  </button>
                  <button
                    type="button"
                    class="pt-framed-control annotation-button"
                    :disabled="!available || busy || loading || !selected.note"
                    @click="clearNote"
                  >
                    <UiIcon name="trash" />Delete note
                  </button>
                </div>
              </form>
              <div v-else>
                <button
                  type="button"
                  class="pt-framed-control annotation-button w-full text-left"
                  :data-note-action="item.id"
                  :disabled="busy || loading"
                  @click="editNote(item.id)"
                >
                  <UiIcon name="note" />{{ item.note ? 'Edit note' : 'Add note' }}
                </button>
                <button
                  type="button"
                  class="pt-framed-control annotation-button mt-2 w-full text-left"
                  :disabled="!available || busy || loading"
                  @click="deleteHighlight(item.id)"
                >
                  <UiIcon name="trash" />Delete highlight and note
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
                    changeColor(
                      item.id,
                      ($event.target as HTMLSelectElement).value as AnnotationColor,
                    )
                  "
                >
                  <option v-for="(label, color) in colors" :key="color" :value="color">
                    {{ label }}
                  </option>
                </select>
              </div>
            </FloatingPopover>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.annotation-filter-bar {
  margin: 0 -20px;
  padding: 0 20px 8px;
  border-bottom: 1px solid var(--pt-line);
  display: grid;
  gap: 12px;
}
.annotation-filters {
  display: grid;
  gap: 12px;
}
.annotation-filters[open] > * + * {
  margin-top: 12px;
}

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
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  border: 1px solid var(--pt-line);
  border-radius: 0.5rem;
  padding: 10px 12px;
  font-size: 0.75rem;
}
.annotation-row {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 12px 46px 16px 0;
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
  font-size: 14px;
  line-height: 1.45;
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
.annotation-menu > button {
  list-style: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}
.annotation-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
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

.annotation-input {
  box-sizing: border-box;
  border: 1px solid var(--pt-line);
}
.annotation-button.pt-framed-control.pt-stable-border:is(:hover, :active, :focus-visible) {
  border: 1px solid var(--pt-line);
  background: var(--pt-control-surface);
}

.annotation-button.pt-framed-control:not(.pt-stable-border):not(:disabled):is(
    :hover,
    :active,
    :focus-visible
  ) {
  border: 1px solid var(--pt-control-edge);
  border-bottom: 2px solid var(--pt-control-edge);
  background: var(--pt-control-surface);
  color: var(--pt-control-ink);
  box-shadow: none;
}
</style>

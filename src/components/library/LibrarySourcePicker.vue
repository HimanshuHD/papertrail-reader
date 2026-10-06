<script setup lang="ts">
import { hideTransitionSurface, restoreTransitionSurface } from '../../services/transition-surface'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import IconButton from '../IconButton.vue'
import {
  canUseDirectoryPicker,
  requestDirectory,
  selectionFromFiles,
  type BrowserLibrarySelection,
  type LibraryRefreshAction,
} from '../../features/library/browser-selection'

const props = defineProps<{
  selectionSummary: string
  refreshAction: LibraryRefreshAction | null
  refreshBusy: boolean
}>()

const emit = defineEmits<{
  selected: [selection: BrowserLibrarySelection]
  refresh: []
  close: []
}>()

const directoryInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const preferNativeDirectoryPicker = ref(canUseDirectoryPicker())
const feedback = ref('')
const feedbackIsError = ref(false)

const refreshLabel = computed(() => {
  switch (props.refreshAction) {
    case 'refresh-directory':
      return 'Refresh folder'
    case 'reselect-directory':
      return 'Reselect folder'
    case 'reselect-files':
      return 'Reselect files'
    default:
      return 'Refresh library'
  }
})

async function chooseFolder() {
  dismissMenu(true)
  feedback.value = ''
  feedbackIsError.value = false

  if (!preferNativeDirectoryPicker.value) {
    directoryInput.value?.click()
    return
  }

  const result = await requestDirectory()
  if (result.ok) {
    emit('selected', result.selection)
    return
  }

  if (result.reason === 'dismissed-or-denied') {
    feedback.value =
      'Folder selection was cancelled or permission was not granted. No files were accessed.'
    return
  }

  preferNativeDirectoryPicker.value = false
  feedbackIsError.value = result.reason !== 'unavailable'
  feedback.value =
    'Native folder access is unavailable here. Choose folder again to use the browser folder fallback.'
}

function chooseFiles() {
  dismissMenu(true)
  feedback.value = ''
  feedbackIsError.value = false
  fileInput.value?.click()
}

function refreshCurrentSource() {
  dismissMenu(true)
  feedback.value = ''
  feedbackIsError.value = false

  switch (props.refreshAction) {
    case 'refresh-directory':
      emit('refresh')
      break
    case 'reselect-directory':
      directoryInput.value?.click()
      break
    case 'reselect-files':
      fileInput.value?.click()
      break
  }
}

function handleInputSelection(event: Event, source: 'directory-input' | 'file-input') {
  dismissMenu(true)
  const input = event.currentTarget as HTMLInputElement
  const selection = selectionFromFiles(input.files ?? [], source)

  if (!selection) {
    feedback.value = 'No files were selected.'
    feedbackIsError.value = false
    return
  }

  dismissMenu(true)
  feedback.value = ''
  feedbackIsError.value = false
  emit('selected', selection)
  input.value = ''
}

const menuOpen = ref(false)
const controls = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
function focusAdd() {
  controls.value?.querySelector<HTMLButtonElement>('[aria-controls="library-source-menu"]')?.focus()
}
function dismissMenu(restoreFocus = false) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (restoreFocus) focusAdd()
}
async function toggleMenu() {
  if (menuOpen.value) {
    dismissMenu(true)
    return
  }
  menuOpen.value = true
  await nextTick()
  menu.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
function menuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    event.preventDefault()
    dismissMenu(true)
    return
  }
  const buttons = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let next: number
  if (event.key === 'ArrowDown') next = (current + 1) % buttons.length
  else if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = buttons.length - 1
  else return
  event.preventDefault()
  buttons[next]?.focus()
}
function outsidePointer(event: PointerEvent) {
  if (event.target instanceof Node && !controls.value?.contains(event.target)) dismissMenu()
}
function focusLeaves(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !controls.value?.contains(event.relatedTarget))
    dismissMenu()
}
onMounted(() => document.addEventListener('pointerdown', outsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outsidePointer))
</script>

<template>
  <div ref="controls" class="relative" @focusout="focusLeaves">
    <div class="flex items-center gap-1">
      <IconButton
        :label="refreshBusy && refreshAction === 'refresh-directory' ? 'Refreshing…' : refreshLabel"
        icon="refresh"
        :disabled="!refreshAction || refreshBusy"
        @click="refreshCurrentSource"
      />
      <IconButton
        label="Add local documents"
        icon="plus"
        aria-controls="library-source-menu"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click="toggleMenu"
        @keydown.down.prevent="!menuOpen && toggleMenu()"
      />
      <IconButton
        label="Hide library"
        icon="close"
        aria-controls="document-sidebar"
        aria-expanded="true"
        @click="$emit('close')"
      />
    </div>
    <Transition
      name="source-menu"
      @before-enter="restoreTransitionSurface"
      @before-leave="hideTransitionSurface"
    >
      <div
        v-if="menuOpen"
        id="library-source-menu"
        ref="menu"
        role="menu"
        aria-label="Add local documents"
        class="absolute top-full right-0 z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-panel p-1 shadow-lg"
        @keydown="menuKeydown"
      >
        <button
          type="button"
          role="menuitem"
          class="pt-list-entry min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-canvas"
          @click="chooseFolder"
        >
          Choose folder
        </button>
        <button
          type="button"
          role="menuitem"
          class="pt-list-entry min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-canvas"
          @click="chooseFiles"
        >
          Choose PDF / EPUB files
        </button>
      </div>
    </Transition>
    <input
      ref="directoryInput"
      type="file"
      multiple
      hidden
      webkitdirectory
      aria-hidden="true"
      tabindex="-1"
      @change="handleInputSelection($event, 'directory-input')"
    />
    <input
      ref="fileInput"
      type="file"
      multiple
      hidden
      accept=".pdf,.epub,application/pdf,application/epub+zip"
      aria-hidden="true"
      tabindex="-1"
      @change="handleInputSelection($event, 'file-input')"
    />
    <p id="library-source-status" class="sr-only" role="status" aria-live="polite">
      {{ feedback || selectionSummary }}
    </p>
    <p
      v-if="feedback"
      class="absolute top-full right-0 z-30 mt-2 w-60 rounded-lg border border-line bg-panel p-3 text-xs text-muted shadow-md"
      :role="feedbackIsError ? 'alert' : undefined"
      :aria-live="feedbackIsError ? 'assertive' : 'polite'"
    >
      {{ feedback }}
    </p>
  </div>
</template>

<style scoped>
.source-menu-enter-active,
.source-menu-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
.source-menu-enter-from,
.source-menu-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .source-menu-enter-active,
  .source-menu-leave-active {
    transition: none;
  }
}
</style>

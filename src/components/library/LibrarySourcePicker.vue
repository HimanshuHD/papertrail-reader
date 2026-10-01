<script setup lang="ts">
import { computed, ref } from 'vue'
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
}>()

const directoryInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const preferNativeDirectoryPicker = ref(canUseDirectoryPicker())
const feedback = ref('')
const feedbackIsError = ref(false)

const folderMethod = computed(() =>
  preferNativeDirectoryPicker.value ? 'Browser folder permission' : 'Folder input fallback',
)

const refreshLabel = computed(() => {
  switch (props.refreshAction) {
    case 'refresh-directory':
      return 'Refresh folder'
    case 'reselect-directory':
      return 'Reselect folder'
    case 'reselect-files':
      return 'Reselect files'
    default:
      return ''
  }
})

async function chooseFolder() {
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
  feedback.value = ''
  feedbackIsError.value = false
  fileInput.value?.click()
}

function refreshCurrentSource() {
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
  const input = event.currentTarget as HTMLInputElement
  const selection = selectionFromFiles(input.files ?? [], source)

  if (!selection) {
    feedback.value = 'No files were selected.'
    feedbackIsError.value = false
    return
  }

  feedback.value = ''
  feedbackIsError.value = false
  emit('selected', selection)
  input.value = ''
}
</script>

<template>
  <section aria-labelledby="library-source-title">
    <h3 id="library-source-title" class="text-xs font-semibold tracking-wider text-muted uppercase">
      Add local documents
    </h3>
    <div class="mt-2 grid gap-2">
      <button
        type="button"
        class="min-h-11 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-medium"
        @click="chooseFolder"
      >
        Choose folder
      </button>
      <button
        type="button"
        class="min-h-11 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-medium"
        @click="chooseFiles"
      >
        Choose PDF / EPUB files
      </button>
      <button
        v-if="refreshAction"
        type="button"
        class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-medium"
        :disabled="refreshBusy"
        @click="refreshCurrentSource"
      >
        {{ refreshBusy && refreshAction === 'refresh-directory' ? 'Refreshing…' : refreshLabel }}
      </button>
    </div>

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

    <p class="mt-2 text-xs leading-relaxed text-muted">
      {{ folderMethod }} · files stay local to this browser session.
    </p>
    <p
      class="mt-2 text-xs leading-relaxed"
      :class="feedbackIsError ? 'text-ink' : 'text-muted'"
      :role="feedbackIsError ? 'alert' : 'status'"
      :aria-live="feedbackIsError ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      {{ feedback || selectionSummary }}
    </p>
  </section>
</template>

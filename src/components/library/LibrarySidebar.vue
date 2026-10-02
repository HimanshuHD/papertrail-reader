<script setup lang="ts">
import { computed } from 'vue'
import LibrarySourcePicker from './LibrarySourcePicker.vue'
import LibraryTree from './LibraryTree.vue'
import type {
  BrowserLibrarySelection,
  LibraryRefreshAction,
} from '../../features/library/browser-selection'
import type { DiscoveredDocument } from '../../features/library/discovery'
import type { ShellDocument } from '../../types/shell'

const props = defineProps<{
  documents: readonly ShellDocument[]
  selectedId: string
  libraryDocuments: readonly DiscoveredDocument[]
  selectedLibraryDocumentId: string | null
  libraryLabel: string
  showLibraryResults: boolean
  refreshAction: LibraryRefreshAction | null
  selectionSummary: string
  discoverySummary: string
  discoveryBusy: boolean
  discoveryProblemCount: number
}>()

defineEmits<{
  select: [id: string]
  selectLibraryDocument: [id: string]
  close: []
  librarySelection: [selection: BrowserLibrarySelection]
  refreshLibrary: []
  cancelDiscovery: []
}>()

const collections = computed(() => [
  ...new Set(props.documents.map((document) => document.collection)),
])
</script>

<template>
  <div @keydown.esc.stop="$emit('close')">
    <header
      class="sticky top-0 z-40 flex items-center justify-between gap-1 border-b border-line bg-panel px-3 py-2"
    >
      <h2 class="text-sm font-semibold">Library</h2>
      <LibrarySourcePicker
        :selection-summary="selectionSummary"
        :refresh-action="refreshAction"
        :refresh-busy="discoveryBusy"
        @selected="$emit('librarySelection', $event)"
        @refresh="$emit('refreshLibrary')"
        @close="$emit('close')"
      />
    </header>
    <div class="px-3 py-3">
      <p id="discovery-status" class="sr-only" role="status" aria-live="polite">
        {{ discoverySummary }}
      </p>
      <div
        v-if="discoveryBusy"
        class="mb-3 flex items-center justify-between gap-2 text-xs text-muted"
      >
        <span>Scanning documents…</span>
        <button
          type="button"
          class="min-h-9 rounded-md border border-line px-2"
          @click="$emit('cancelDiscovery')"
        >
          Cancel scan
        </button>
      </div>
      <p v-if="discoveryProblemCount > 0" class="mb-3 text-xs text-muted">
        {{ discoveryProblemCount }} access issue(s); readable files remain available.
      </p>
      <p v-if="!showLibraryResults" class="mb-4 text-xs text-muted">
        Use + to add a folder or files.
      </p>
      <section v-if="showLibraryResults" class="space-y-3" aria-labelledby="local-library-title">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3
              id="local-library-title"
              class="text-xs font-semibold tracking-wider text-muted uppercase"
            >
              Local documents
            </h3>
            <p class="mt-1 break-words text-sm font-medium">{{ libraryLabel }}</p>
          </div>
          <span class="shrink-0 rounded-full border border-line px-2 py-1 text-[11px] text-muted">
            {{ libraryDocuments.length }}
          </span>
        </div>

        <div class="mt-3">
          <LibraryTree
            v-if="libraryDocuments.length > 0"
            :documents="libraryDocuments"
            :selected-id="selectedLibraryDocumentId"
            @select="$emit('selectLibraryDocument', $event)"
          />
          <p v-else class="text-xs leading-relaxed text-muted">
            No supported PDF or EPUB documents are available in this selection.
          </p>
        </div>
      </section>

      <nav v-if="!showLibraryResults" class="space-y-4" aria-label="Demonstration documents">
        <div>
          <h3 class="text-xs font-semibold tracking-wider text-muted uppercase">
            Demonstration workspace
          </h3>
        </div>

        <section v-for="collection in collections" :key="collection">
          <h4 class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            {{ collection }}
          </h4>
          <ul class="space-y-1">
            <li
              v-for="document in documents.filter((item) => item.collection === collection)"
              :key="document.id"
            >
              <button
                type="button"
                :aria-pressed="selectedId === document.id"
                :class="[
                  'flex min-h-14 w-full items-start gap-3 rounded-lg border p-3 text-left',
                  selectedId === document.id
                    ? 'border-brand bg-canvas'
                    : 'border-transparent hover:bg-canvas',
                ]"
                @click="$emit('select', document.id)"
              >
                <span
                  class="mt-0.5 rounded border border-line px-1 py-0.5 text-[10px] font-bold text-brand"
                  >{{ document.format }}</span
                >
                <span class="min-w-0 break-words text-sm"
                  ><span class="block font-medium">{{ document.title }}</span
                  ><span class="mt-1 block text-xs text-muted">{{ document.detail }}</span></span
                >
              </button>
            </li>
          </ul>
        </section>
      </nav>
    </div>
  </div>
</template>

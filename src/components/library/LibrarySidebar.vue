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

const selectedLibraryDocument = computed(
  () =>
    props.libraryDocuments.find((document) => document.id === props.selectedLibraryDocumentId) ??
    null,
)
</script>

<template>
  <div class="p-5" @keydown.esc.stop="$emit('close')">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-semibold">Your library</h2>
      <span class="rounded-full border border-line px-2 py-1 text-xs text-muted">Local</span>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Choose local documents explicitly. Discovered files appear as a local tree below. PDF files
      now open in the browser reader; EPUB reading remains planned.
    </p>

    <div class="mt-5">
      <LibrarySourcePicker
        :selection-summary="selectionSummary"
        :refresh-action="refreshAction"
        :refresh-busy="discoveryBusy"
        @selected="$emit('librarySelection', $event)"
        @refresh="$emit('refreshLibrary')"
      />
    </div>

    <section class="mt-4 rounded-lg border border-line bg-canvas p-3" aria-labelledby="scan-title">
      <div class="flex items-center justify-between gap-3">
        <h3 id="scan-title" class="text-xs font-semibold tracking-wider text-muted uppercase">
          Discovery
        </h3>
        <button
          v-if="discoveryBusy"
          type="button"
          class="min-h-9 rounded-md border border-line px-3 py-1 text-xs font-medium"
          @click="$emit('cancelDiscovery')"
        >
          Cancel scan
        </button>
      </div>
      <p class="mt-2 text-xs leading-relaxed text-muted" role="status" aria-live="polite">
        {{ discoverySummary }}
      </p>
      <p v-if="discoveryProblemCount > 0" class="mt-2 text-xs leading-relaxed text-muted">
        {{ discoveryProblemCount }} recoverable access issue(s) recorded. Other readable documents
        remain available.
      </p>
    </section>

    <section
      v-if="showLibraryResults"
      class="mt-5 rounded-lg border border-line p-3"
      aria-labelledby="local-library-title"
    >
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

      <p
        v-if="selectedLibraryDocument"
        class="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted"
      >
        <template v-if="selectedLibraryDocument.format === 'PDF'">
          Open in PDF reader:
          <strong class="font-medium text-ink">{{ selectedLibraryDocument.name }}</strong
          >.
        </template>
        <template v-else>
          Selected EPUB:
          <strong class="font-medium text-ink">{{ selectedLibraryDocument.name }}</strong
          >. EPUB reading remains #12.
        </template>
      </p>
    </section>

    <nav class="mt-6 space-y-5" aria-label="Demonstration documents">
      <div>
        <h3 class="text-xs font-semibold tracking-wider text-muted uppercase">
          Demonstration workspace
        </h3>
        <p class="mt-1 text-xs leading-relaxed text-muted">
          Sample titles only change the preview workspace.
        </p>
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

    <p class="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">
      PaperTrail only receives files you explicitly choose. Live directory handles can be refreshed
      in-session; folder/file snapshots require explicit reselection.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import LibrarySourcePicker from './LibrarySourcePicker.vue'
import LibraryTree from './LibraryTree.vue'
import RecentDocuments from './RecentDocuments.vue'
import LoadingState from '../LoadingState.vue'
import UiIcon from '../UiIcon.vue'
import type {
  BrowserLibrarySelection,
  LibraryRefreshAction,
} from '../../features/library/browser-selection'
import type { LibraryDocumentMetadata } from '../../features/library/discovery'

import { filterLibrary, type RecentDocument } from '../../services/recent-documents'

const props = defineProps<{
  libraryDocuments: readonly LibraryDocumentMetadata[]
  selectedLibraryDocumentId: string | null
  libraryLabel: string
  showLibraryResults: boolean
  refreshAction: LibraryRefreshAction | null
  selectionSummary: string
  discoverySummary: string
  discoveryBusy: boolean
  discoveryProblemCount: number
  collapsedPaths?: readonly string[]
  scrollPosition?: number
  cached?: boolean
  workspaceMessage?: string
  canResume?: boolean
  hasWorkspace?: boolean
  recentDocuments?: readonly RecentDocument[]
  recentMessage?: string
  recentBusy?: boolean
}>()

defineEmits<{
  selectLibraryDocument: [id: string]
  close: []
  librarySelection: [selection: BrowserLibrarySelection]
  refreshLibrary: []
  cancelDiscovery: []
  toggleFolder: [path: string, expanded: boolean]
  libraryScroll: [position: number]
  resumeWorkspace: []
  forgetWorkspace: []
  openRecent: [entry: RecentDocument]
  removeRecent: [id: string]
  clearRecents: []
  retryRecents: []
}>()
const query = ref('')
const filtered = computed(() => filterLibrary(props.libraryDocuments, query.value))
const list = ref<HTMLElement | null>(null)
watch(
  [() => props.scrollPosition, () => props.libraryDocuments, list],
  async () => {
    await nextTick()
    if (list.value && props.scrollPosition !== undefined)
      list.value.scrollTop = props.scrollPosition
  },
  { immediate: true },
)
</script>

<template>
  <div class="library-panel flex h-full min-h-0 flex-col" @keydown.esc.stop="$emit('close')">
    <header
      class="relative z-40 flex shrink-0 items-center justify-between gap-1 border-b border-line bg-panel px-3 py-2"
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

    <div class="shrink-0 border-b border-line px-3 py-3">
      <div class="relative">
        <UiIcon
          name="search"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <input
          id="library-filter"
          v-model="query"
          type="search"
          maxlength="200"
          placeholder="Search documents..."
          aria-label="Search library"
          class="min-h-11 w-full rounded-lg border border-line bg-canvas py-2 pr-10 pl-10 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          v-if="query"
          type="button"
          aria-label="Clear library search"
          class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-brand"
          @click="query = ''"
        >
          <UiIcon name="close" />
        </button>
      </div>
      <p v-if="query" role="status" class="sr-only">{{ filtered.length }} matching documents</p>
    </div>

    <div v-if="hasWorkspace" class="shrink-0 border-b border-line px-3 py-2 text-xs">
      <p v-if="workspaceMessage" role="status" class="mb-2 text-muted">{{ workspaceMessage }}</p>
      <button
        v-if="canResume"
        type="button"
        class="mr-3 rounded border border-line px-2 py-1 text-brand"
        @click="$emit('resumeWorkspace')"
      >
        Resume library
      </button>
      <button type="button" class="text-muted hover:text-brand" @click="$emit('forgetWorkspace')">
        Forget library
      </button>
    </div>
    <p id="discovery-status" class="sr-only" role="status" aria-live="polite">
      {{ discoverySummary }}
    </p>
    <div
      ref="list"
      class="library-list min-h-0 flex-1 overflow-auto px-3 py-3"
      role="region"
      aria-label="Library documents"
      tabindex="0"
      :aria-busy="discoveryBusy"
      @scroll.passive="$emit('libraryScroll', ($event.target as HTMLElement).scrollTop)"
    >
      <LoadingState
        v-if="discoveryBusy"
        label="Loading your library"
        :rotate-messages="true"
        :announce="false"
      >
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line bg-canvas px-4 text-xs font-medium text-ink shadow-sm hover:border-brand hover:text-brand"
          @click="$emit('cancelDiscovery')"
        >
          Cancel scan
        </button>
      </LoadingState>

      <p v-if="discoveryProblemCount > 0" class="mb-3 text-xs text-muted">
        {{ discoveryProblemCount }} access issue(s); readable files remain available.
      </p>

      <section
        v-if="!showLibraryResults && !discoveryBusy"
        class="library-empty-state mt-2 rounded-2xl border border-dashed border-line px-4 py-7 text-center"
        aria-labelledby="library-empty-title"
      >
        <div
          class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel text-brand shadow-sm"
          aria-hidden="true"
        >
          <UiIcon name="plus" />
        </div>
        <h3 id="library-empty-title" class="mt-4 text-sm font-semibold">
          No documents selected yet
        </h3>
        <p class="mt-2 text-xs leading-relaxed text-muted">
          Use the <span class="font-semibold text-brand">+</span> button above to add a folder or
          choose PDF / EPUB files.
        </p>
        <p class="mt-3 text-[11px] leading-relaxed text-muted">
          PaperTrail only reads files you explicitly choose.
        </p>
      </section>

      <RecentDocuments
        :documents="recentDocuments ?? []"
        :message="recentMessage"
        :busy="recentBusy"
        @open="$emit('openRecent', $event)"
        @remove="$emit('removeRecent', $event)"
        @clear="$emit('clearRecents')"
        @retry="$emit('retryRecents')"
      />

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
            v-if="filtered.length > 0"
            :documents="filtered"
            :selected-id="selectedLibraryDocumentId"
            :collapsed-paths="query.trim() ? [] : collapsedPaths"
            :disabled="cached"
            @toggle="(path, expanded) => !query.trim() && $emit('toggleFolder', path, expanded)"
            @select="$emit('selectLibraryDocument', $event)"
          />
          <div
            v-else
            class="rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-center"
          >
            <p class="text-sm font-medium">
              {{ query ? 'No matching documents' : 'No supported documents found' }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              Choose another source with PDF or EPUB files.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.library-empty-state {
  background:
    radial-gradient(
      circle at 50% 0%,
      color-mix(in srgb, var(--pt-brand) 10%, transparent),
      transparent 46%
    ),
    color-mix(in srgb, var(--pt-canvas) 72%, var(--pt-panel));
}
</style>

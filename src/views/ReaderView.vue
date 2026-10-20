<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, shallowRef } from 'vue'
import IconButton from '../components/IconButton.vue'
import WorkspaceBrand from '../components/layout/WorkspaceBrand.vue'
import BuildFooter from '../components/BuildFooter.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import DocumentTabs from '../components/viewer/DocumentTabs.vue'
import ComparisonPicker from '../components/viewer/ComparisonPicker.vue'
import type { DocumentSession } from '../features/reader/document-sessions'
import DocumentSessionWorkspace from '../components/viewer/DocumentSessionWorkspace.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
import {
  describeLibrarySelection,
  librarySelectionLabel,
  refreshActionForSelection,
  type BrowserLibrarySelection,
} from '../features/library/browser-selection'
import {
  discoverDocuments,
  type DiscoveredDocument,
  type DiscoveryProblem,
  type DiscoveryProgress,
} from '../features/library/discovery'

import { waitForMinimumLoading } from '../features/library/loading-duration'
import { enrichPdfTitles } from '../features/library/pdf-titles'

import { useWorkspaceContinuity } from '../composables/useWorkspaceContinuity'
import { startupScreen } from '../services/startup-screen'
import { cacheLibraryDocuments, type WorkspaceSnapshot } from '../services/workspace-storage'
import { revalidateTabs } from '../services/tab-revalidation'
import { migrateWorkspaceTabs } from '../features/reader/session-snapshot'

import { useRecentDocuments } from '../composables/useRecentDocuments'
import { matchRecent, type RecentDocument } from '../services/recent-documents'

type DiscoveryPhase = 'idle' | 'indexing' | 'ready' | 'cancelled' | 'error'

const workspace = useWorkspaceContinuity(undefined, saveTabs)
let tabsHydrated = false
let lastTabs = ''
function saveTabs() {
  if (!tabsHydrated || !workspace.snapshot.value || !readerSessions.value) return
  try {
    const saved = readerSessions.value.snapshot()
    const serialized = JSON.stringify(saved)
    if (serialized !== lastTabs) {
      lastTabs = serialized
      workspace.patch({ tabs: saved })
    }
  } catch {
    workspace.notice.value =
      'Tab state could not be saved. Close some tabs or use Forget library to reset workspace storage.'
  }
}
const recents = useRecentDocuments()
const recentMessage = ref('')
const recentOpening = ref(false)
let recentController: AbortController | null = null
function cancelRecent() {
  recentController?.abort()
  recentOpening.value = false
}
function rememberRecent(identity: { id: string; fingerprint: string }) {
  const item = currentDocument.value
  if (item)
    void recents.remember({
      ...identity,
      format: item.format,
      name: item.name,
      title: item.title,
      relativePath: item.relativePath,
      openedAt: Date.now(),
    })
}
async function openRecent(entry: RecentDocument) {
  cancelRecent()
  const controller = new AbortController()
  recentController = controller
  recentOpening.value = true
  recentMessage.value = 'Checking recent document access…'
  try {
    const item = await matchRecent(entry, discoveredDocuments.value, controller.signal)
    if (controller.signal.aborted) return
    if (item) {
      selectLibraryDocument(item.id)
      recentMessage.value = ''
    } else
      recentMessage.value =
        'This recent document is unavailable or changed. Use + to reselect its source, then try it again.'
  } catch {
    if (!controller.signal.aborted)
      recentMessage.value =
        'Recent document access could not be checked. Use + to reselect its source.'
  } finally {
    if (recentController === controller) recentOpening.value = false
  }
}
const sidebarWidth = ref(308)
const reconnecting = ref(false)
let workspaceOperation = 0
const displayDocuments = computed(() =>
  discoveredDocuments.value.length || discoveryPhase.value === 'ready'
    ? discoveredDocuments.value
    : (workspace.snapshot.value?.documents ?? []),
)
const cached = computed(
  () =>
    Boolean(workspace.snapshot.value) &&
    (!librarySelection.value || (reconnecting.value && !discoveredDocuments.value.length)),
)
const workspaceMessage = computed(
  () =>
    workspace.notice.value ||
    (reconnecting.value
      ? 'Reconnecting your library…'
      : cached.value
        ? 'Saved library. Resume access or use + to select the same source again.'
        : ''),
)
const readerSessions = ref<InstanceType<typeof DocumentSessionWorkspace> | null>(null)
const librarySidebar = ref<InstanceType<typeof LibrarySidebar> | null>(null)
const tabs = shallowRef<DocumentSession[]>([])
const selectedTab = ref<string | null>(null)
const comparisonIds = shallowRef<[string, string] | null>(null)
const documentRequest = ref(0)
const currentDocument = shallowRef<DiscoveredDocument | null>(null)
function sessionChanged(document: DiscoveredDocument | null, fingerprint: string | null) {
  if (!tabsHydrated) return
  currentDocument.value = document
  selectedLibraryDocumentId.value = document?.id ?? null
  workspace.patch({
    selectedPath: document?.relativePath ?? null,
    activePath: document?.relativePath ?? null,
    activeFingerprint: fingerprint,
  })
}
async function focusLibraryActions() {
  await nextTick()
  if (!sidebarOpen.value) (sidebarToggle.value?.$el as HTMLButtonElement | undefined)?.focus()
  else
    (librarySidebar.value?.$el as HTMLElement | undefined)
      ?.querySelector<HTMLButtonElement>('[aria-controls="library-source-menu"]')
      ?.focus()
}

const restoringDocument = ref(false)
const selectedLibraryDocumentId = ref<string | null>(null)
const activeDocument = shallowRef<DiscoveredDocument | null>(null)
const sidebarOpen = ref(true)
watch(sidebarOpen, (value) => workspace.patch({ sidebarOpen: value }))
const sidebarToggle = ref<InstanceType<typeof IconButton> | null>(null)
const announcement = ref('PaperTrail workspace ready. No documents selected yet.')

const librarySelection = shallowRef<BrowserLibrarySelection | null>(null)
const discoveryPhase = ref<DiscoveryPhase>('idle')
const discoveryProgress = ref<DiscoveryProgress>({
  scanned: 0,
  supported: 0,
  currentPath: '',
})
const discoveredDocuments = shallowRef<readonly DiscoveredDocument[]>([])
const discoveryProblems = shallowRef<readonly DiscoveryProblem[]>([])
let discoveryController: AbortController | null = null
let metadataController: AbortController | null = null
onBeforeUnmount(() => {
  saveTabs()
  workspaceOperation += 1
  cancelRecent()
  discoveryController?.abort()
  metadataController?.abort()
})

const librarySelectionSummary = computed(() =>
  librarySelection.value
    ? describeLibrarySelection(librarySelection.value)
    : 'No folder or files selected yet.',
)

const libraryLabel = computed(() =>
  librarySelection.value
    ? librarySelectionLabel(librarySelection.value)
    : (workspace.snapshot.value?.label ?? 'Local documents'),
)

const refreshAction = computed(() =>
  librarySelection.value ? refreshActionForSelection(librarySelection.value) : null,
)

const showLibraryResults = computed(
  () =>
    Boolean(workspace.snapshot.value) ||
    discoveryPhase.value === 'ready' ||
    discoveryPhase.value === 'cancelled',
)

const discoverySummary = computed(() => {
  switch (discoveryPhase.value) {
    case 'idle':
      return 'Document discovery starts after you choose a source.'
    case 'indexing':
      return `Scanning… ${discoveryProgress.value.scanned} files checked, ${discoveryProgress.value.supported} supported.`
    case 'cancelled':
      return `Discovery cancelled. ${discoveredDocuments.value.length} supported documents were found before cancellation.`
    case 'error':
      return 'Document discovery stopped unexpectedly. Your selected files were not changed.'
    case 'ready': {
      const count = discoveredDocuments.value.length
      const noun = count === 1 ? 'document' : 'documents'
      if (count === 0) {
        return discoveryProblems.value.length > 0
          ? 'No readable PDF or EPUB documents were found. Some selected items could not be accessed.'
          : 'No PDF or EPUB documents were found in this selection.'
      }
      const problemSuffix =
        discoveryProblems.value.length > 0
          ? ` ${discoveryProblems.value.length} selected item(s) could not be read.`
          : ''
      return `${count} supported ${noun} found.${problemSuffix}`
    }
    default:
      return 'Document discovery state is unavailable.'
  }
})

const selectedLibraryDocument = computed(
  () =>
    displayDocuments.value.find((document) => document.id === selectedLibraryDocumentId.value) ??
    null,
)

function selectLibraryDocument(id: string, restoring = false) {
  const document = discoveredDocuments.value.find((item) => item.id === id)
  if (!document) return

  if (!restoring) {
    workspaceOperation += 1
    cancelRecent()
    reconnecting.value = false
  }
  const sameActive =
    currentDocument.value?.id === document.id && currentDocument.value?.file === document.file
  selectedLibraryDocumentId.value = id
  workspace.patch({
    selectedPath: document.relativePath,
    activePath: document.relativePath,
    ...(!restoring && !sameActive ? { utilityPanel: null, searchQuery: '' } : {}),
    activeFingerprint:
      restoring || sameActive ? (workspace.snapshot.value?.activeFingerprint ?? null) : null,
  })
  restoringDocument.value = restoring
  activeDocument.value = document
  documentRequest.value += 1
  announcement.value = `Opening local ${document.format}: ${document.name}.`
}

function restoreLibrarySelection(
  previous: { id: string; relativePath: string } | null,
  documents: readonly DiscoveredDocument[],
): string | null {
  if (!previous) return null

  const exact = documents.find((document) => document.id === previous.id)
  if (exact) return exact.id

  const samePath = documents.filter((document) => document.relativePath === previous.relativePath)
  return samePath.length === 1 ? samePath[0]!.id : null
}

async function runDiscovery(
  selection: BrowserLibrarySelection,
  preserveSelection: boolean,
  quiet = false,
): Promise<void> {
  const previous = preserveSelection ? selectedLibraryDocument.value : null

  discoveryController?.abort()
  metadataController?.abort()
  const controller = new AbortController()
  const startedAt = Date.now()
  discoveryController = controller
  discoveryPhase.value = 'indexing'
  discoveryProgress.value = { scanned: 0, supported: 0, currentPath: '' }
  discoveredDocuments.value = []
  discoveryProblems.value = []

  try {
    const result = await discoverDocuments(selection, {
      signal: controller.signal,
      onProgress(progress) {
        if (discoveryController === controller) discoveryProgress.value = progress
      },
    })

    if (discoveryController !== controller) return

    discoveredDocuments.value = result.documents
    workspace.patch({ documents: cacheLibraryDocuments(result.documents) })
    discoveryProblems.value = result.problems
    selectedLibraryDocumentId.value = restoreLibrarySelection(previous, result.documents)
    if (!quiet && result.status === 'completed' && result.problems.length === 0)
      await waitForMinimumLoading(startedAt, controller.signal)
    if (discoveryController !== controller) return
    const cancelled = result.status === 'cancelled' || controller.signal.aborted
    if (!cancelled) {
      const metadata = new AbortController()
      metadataController = metadata
      void enrichPdfTitles(result.documents, metadata.signal, (id, title) => {
        if (metadataController !== metadata || metadata.signal.aborted) return
        discoveredDocuments.value = discoveredDocuments.value.map((document) =>
          document.id === id ? { ...document, title } : document,
        )
        workspace.patch({ documents: cacheLibraryDocuments(discoveredDocuments.value) })
      })
    }
    discoveryPhase.value = cancelled ? 'cancelled' : 'ready'
    announcement.value = cancelled
      ? `Document discovery cancelled after ${result.scanned} files.`
      : `${result.documents.length} supported documents discovered.`
  } catch {
    if (discoveryController !== controller) return
    selectedLibraryDocumentId.value = null
    discoveryPhase.value = 'error'
    announcement.value = 'Document discovery failed.'
  }
}

async function reconnect(
  selection: BrowserLibrarySelection,
  saved: WorkspaceSnapshot,
  owner: number,
  allowRenames = false,
) {
  reconnecting.value = true
  try {
    const remembered = readerSessions.value?.snapshot() ?? migrateWorkspaceTabs(saved)
    librarySelection.value = selection
    activeDocument.value = null
    await readerSessions.value?.disconnectSources()
    if (owner !== workspaceOperation) return
    await runDiscovery(selection, false, true)
    if (owner !== workspaceOperation || discoveryPhase.value !== 'ready') return
    const matches = await revalidateTabs(
      remembered,
      discoveredDocuments.value,
      discoveryController?.signal,
      allowRenames,
    )
    if (owner !== workspaceOperation) return
    for (const entry of remembered.sessions) {
      const document = matches.get(entry.id)
      if (document && entry.fingerprint)
        readerSessions.value?.sessions.reconnect(entry.id, document, entry.fingerprint)
    }
    const selected = readerSessions.value?.sessions.selectedId
    if (selected) await readerSessions.value?.activate(selected)
    if (matches.size < remembered.sessions.length)
      workspace.notice.value =
        'Some saved documents are missing, changed or unavailable. Reselect their source to reconnect matching content, or close those tabs.'
    else workspace.notice.value = ''
    saveTabs()
  } catch {
    if (owner === workspaceOperation)
      workspace.notice.value =
        'Library access could not be restored. Choose your source again. Saved tabs and reading positions are retained.'
  } finally {
    if (owner === workspaceOperation) reconnecting.value = false
  }
}

async function acceptLibrarySelection(selection: BrowserLibrarySelection) {
  saveTabs()
  const saved = workspace.snapshot.value
  const owner = ++workspaceOperation
  cancelRecent()
  const label = librarySelectionLabel(selection)
  if (saved) {
    workspace.patch({
      source: selection.source,
      label,
      handle: selection.kind === 'directory' ? selection.handle : null,
    })
    await reconnect(selection, saved, owner, true)
    return
  }
  reconnecting.value = false
  activeDocument.value = null
  librarySelection.value = selection
  selectedLibraryDocumentId.value = null
  workspace.remember({
    version: 1,
    source: selection.source,
    label,
    handle: selection.kind === 'directory' ? selection.handle : null,
    documents: [],
    selectedPath: null,
    activePath: null,
    activeFingerprint: null,
    collapsedPaths: [],
    libraryScroll: 0,
    sidebarOpen: sidebarOpen.value,
    sidebarWidth: sidebarWidth.value,
  })
  tabsHydrated = true
  lastTabs = ''
  saveTabs()
  announcement.value = describeLibrarySelection(selection)
  await runDiscovery(selection, false)
}

async function recoverSession() {
  sidebarOpen.value = true
  await nextTick()
  if (workspace.snapshot.value?.handle && cached.value) await resumeWorkspace()
  else librarySidebar.value?.openSourcePicker()
}

async function resumeWorkspace() {
  const saved = workspace.snapshot.value
  if (!saved || reconnecting.value) return
  const owner = ++workspaceOperation
  cancelRecent()
  const access = await workspace.resume()
  if (owner !== workspaceOperation) return
  if (access?.status === 'granted') await reconnect(access.selection, saved, owner)
  else
    workspace.notice.value = 'Access was not granted. Resume again or use + to reselect the source.'
}

async function forgetWorkspace() {
  tabsHydrated = false
  lastTabs = ''
  workspaceOperation += 1
  await readerSessions.value?.reset()
  cancelRecent()
  discoveryController?.abort()
  metadataController?.abort()
  discoveryController = null
  metadataController = null
  reconnecting.value = false
  activeDocument.value = null
  librarySelection.value = null
  currentDocument.value = null
  discoveredDocuments.value = []
  selectedLibraryDocumentId.value = null
  discoveryPhase.value = 'idle'
  await workspace.forget()
}

function saveSidebarWidth(width: number) {
  sidebarWidth.value = width
  workspace.patch({ sidebarWidth: width })
}

function toggleFolder(path: string, expanded: boolean) {
  const paths = new Set(workspace.snapshot.value?.collapsedPaths ?? [])
  if (expanded) paths.delete(path)
  else paths.add(path)
  workspace.patch({ collapsedPaths: [...paths] })
}

onMounted(async () => {
  startupScreen.stage('library', 'Checking your saved library')
  const owner = workspaceOperation
  const access = await workspace.restore((saved) => {
    if (owner !== workspaceOperation) return
    sidebarOpen.value = saved.sidebarOpen
    sidebarWidth.value = saved.sidebarWidth
    selectedLibraryDocumentId.value =
      saved.documents.find((item) => item.relativePath === saved.selectedPath)?.id ?? null
    readerSessions.value?.restoreWorkspace(migrateWorkspaceTabs(saved))
    tabsHydrated = true
    lastTabs = ''
    saveTabs()
    // Saved metadata is usable before permission checks or folder rescans finish.
    startupScreen.complete('library')
    startupScreen.stage('reader', 'Preparing the reader')
    void nextTick().then(() => startupScreen.ready())
  })
  startupScreen.complete('library')
  startupScreen.stage('reader', 'Preparing the reader')
  await nextTick()
  startupScreen.ready()
  const saved = workspace.snapshot.value
  if (!saved || owner !== workspaceOperation) return
  if (access?.status === 'granted') await reconnect(access.selection, saved, owner)
})

async function refreshLibrary() {
  const selection = librarySelection.value
  const saved = workspace.snapshot.value
  if (!selection || selection.kind !== 'directory' || !saved) return
  saveTabs()
  const owner = ++workspaceOperation
  cancelRecent()
  announcement.value = `Refreshing folder ${selection.handle.name}.`
  await reconnect(selection, saved, owner, true)
}

function cancelDiscovery() {
  workspaceOperation += 1
  cancelRecent()
  reconnecting.value = false
  discoveryController?.abort()
  discoveryPhase.value = 'cancelled'
  announcement.value = 'Document discovery cancelled.'
}

async function openSidebar() {
  sidebarOpen.value = true
  announcement.value = 'Library shown.'
  await nextTick()
  document
    .querySelector<HTMLButtonElement>('#document-sidebar button[aria-label="Hide library"]')
    ?.focus()
}

async function closeSidebarAndRestoreFocus() {
  if (!sidebarOpen.value) return
  sidebarOpen.value = false
  announcement.value = 'Library hidden.'
  await nextTick()
  const opener = sidebarToggle.value?.$el as HTMLButtonElement | undefined
  opener?.focus()
}
</script>

<template>
  <main class="reader-app w-full" aria-label="PaperTrail application">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <ReaderShell
      :sidebar-open="sidebarOpen"
      :initial-width="sidebarWidth"
      @width-change="saveSidebarWidth"
      @close="closeSidebarAndRestoreFocus"
    >
      <template v-if="!sidebarOpen" #opener>
        <WorkspaceBrand />
        <IconButton
          ref="sidebarToggle"
          label="Show library"
          icon="library"
          tooltip-align="start"
          aria-controls="document-sidebar"
          aria-expanded="false"
          class="text-brand"
          @click="openSidebar"
        />
      </template>
      <template #sidebar>
        <div class="sidebar-workspace">
          <WorkspaceBrand class="border-b border-line" />
          <LibrarySidebar
            ref="librarySidebar"
            :library-documents="displayDocuments"
            :recent-documents="recents.entries.value"
            :recent-message="recentMessage || recents.notice.value"
            :recent-busy="recentOpening || recents.busy.value"
            :collapsed-paths="workspace.snapshot.value?.collapsedPaths"
            :scroll-position="workspace.snapshot.value?.libraryScroll"
            :cached="cached"
            :has-workspace="Boolean(workspace.snapshot.value) || Boolean(workspace.notice.value)"
            :workspace-message="workspaceMessage"
            :can-resume="Boolean(workspace.snapshot.value?.handle) && cached && !reconnecting"
            :selected-library-document-id="selectedLibraryDocumentId"
            :library-label="libraryLabel"
            :show-library-results="showLibraryResults"
            :refresh-action="refreshAction"
            :selection-summary="librarySelectionSummary"
            :discovery-summary="discoverySummary"
            :discovery-busy="discoveryPhase === 'indexing' && !cached"
            :discovery-problem-count="discoveryProblems.length"
            @open-recent="openRecent"
            @remove-recent="recents.remove($event)"
            @clear-recents="recents.remove()"
            @retry-recents="recents.reload()"
            @toggle-folder="toggleFolder"
            @library-scroll="workspace.patch({ libraryScroll: $event })"
            @resume-workspace="resumeWorkspace"
            @forget-workspace="forgetWorkspace"
            @select-library-document="selectLibraryDocument"
            @library-selection="acceptLibrarySelection"
            @refresh-library="refreshLibrary"
            @cancel-discovery="cancelDiscovery"
            @close="closeSidebarAndRestoreFocus"
          />
          <BuildFooter />
        </div>
      </template>
      <template #tabs>
        <DocumentTabs
          :tabs="tabs"
          :selected-id="selectedTab"
          @activate="readerSessions?.activate($event)"
          @close="readerSessions?.close($event)"
          @empty-close="focusLibraryActions"
        />
        <ComparisonPicker
          v-if="!comparisonIds"
          :tabs="tabs"
          :selected-id="selectedTab"
          @compare="readerSessions?.compareWith($event)"
        />
      </template>
      <DocumentSessionWorkspace
        ref="readerSessions"
        persistent
        :request="documentRequest"
        :document="activeDocument"
        :initial-panel="restoringDocument ? workspace.snapshot.value?.utilityPanel : null"
        :initial-search-query="
          restoringDocument ? workspace.snapshot.value?.searchQuery : undefined
        "
        @change="
          (items, id) => {
            tabs = items
            selectedTab = id
          }
        "
        @comparison-change="comparisonIds = $event"
        @snapshot-change="saveTabs"
        @recover="recoverSession"
        @active-change="sessionChanged"
        @utility-change="
          (panel, query) => workspace.patch({ utilityPanel: panel, searchQuery: query })
        "
        @status="announcement = $event"
        @identity="workspace.patch({ activeFingerprint: $event })"
        @recent-ready="rememberRecent"
      >
        <ReaderWorkspace
          :selected-document="selectedLibraryDocument"
          :has-library-selection="Boolean(librarySelection)"
        />
      </DocumentSessionWorkspace>
    </ReaderShell>
  </main>
</template>

<style scoped>
.reader-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.sidebar-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sidebar-workspace > .library-panel {
  flex: 1;
  min-height: 0;
  height: auto;
}
.sidebar-workspace > .build-footer {
  flex-shrink: 0;
  max-height: 20dvh;
  overflow: auto;
}
</style>

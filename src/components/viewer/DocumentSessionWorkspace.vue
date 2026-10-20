<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { fingerprintDocument } from '../../services/document-identity'
import { fingerprintEpub } from '../../services/epub-reading-storage'
import PdfReaderWorkspace from './PdfReaderWorkspace.vue'
import EpubReaderWorkspace from './EpubReaderWorkspace.vue'
import {
  DocumentSessions,
  type ActiveSession,
  type DocumentSession,
  type SessionRuntime,
  type UtilityPanel,
} from '../../features/reader/document-sessions'
import type { WorkspaceTabs } from '../../features/reader/session-snapshot'
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  document: DiscoveredDocument | null
  persistent?: boolean
  request?: number
  initialPanel?: UtilityPanel
  initialSearchQuery?: string
}>()
const emit = defineEmits<{
  status: [message: string]
  snapshotChange: []
  recover: []
  change: [tabs: DocumentSession[], selectedId: string | null]
  activeChange: [document: DiscoveredDocument | null, fingerprint: string | null]
  identity: [fingerprint: string]
  recentReady: [identity: { id: string; fingerprint: string }]
  utilityChange: [panel: UtilityPanel, query: string]
}>()
const active = shallowRef<ActiveSession | null>(null)
const readers = shallowRef<ActiveSession[]>([])
const selected = shallowRef<string | null>(null)
const reconnect = shallowRef(false)
const panels = shallowRef<DocumentSession[]>([])
let disposed = false
const sessions = new DocumentSessions(() => {
  if (disposed) return
  selected.value = sessions.selectedId
  reconnect.value = sessions.sessions.get(sessions.selectedId ?? '')?.phase === 'reconnect'
  const previous = active.value
  active.value = sessions.active
  readers.value = [...sessions.retained.values()]
  panels.value = [...sessions.sessions.values()].filter((item) => item.phase !== 'closed')
  emit(
    'change',
    [...sessions.sessions.values()]
      .filter((item) => item.phase !== 'closed')
      .map((item) => ({ ...item })),
    sessions.selectedId,
  )
  emit('snapshotChange')
  if (active.value && previous !== active.value) publishActive()
  else if (!sessions.selectedId) emit('activeChange', null, null)
})
function publishActive() {
  const owner = sessions.active
  if (!owner) return
  emit('activeChange', owner.document, owner.session.fingerprint)
  emit('utilityChange', owner.session.state.panel, owner.session.state.query)
}
function utility(owner: ActiveSession, panel: UtilityPanel, query: string) {
  if (!current(owner)) return
  owner.session.state.panel = panel
  owner.session.state.query = query
  emit('utilityChange', panel, query)
  emit('snapshotChange')
}
function attach(runtime: unknown, owner: ActiveSession) {
  if (runtime) sessions.attach(owner.session.id, owner.generation, runtime as SessionRuntime)
}
function current(owner: ActiveSession) {
  return sessions.owns(owner.session.id, owner.generation)
}
function identity(owner: ActiveSession, fingerprint: string) {
  if (sessions.update(owner.session.id, owner.generation, 'ready', fingerprint) && current(owner))
    emit('identity', fingerprint)
}
function reportOpenFailure() {
  emit('status', 'This document could not be opened. Select it again or choose another local file.')
}
let opening: AbortController | null = null
async function open(document: DiscoveredDocument) {
  opening?.abort()
  const owner = new AbortController()
  opening = owner
  emit('status', `Checking local ${document.format}: ${document.name}.`)
  let fingerprint: string | undefined
  try {
    fingerprint = await (document.format === 'EPUB' ? fingerprintEpub : fingerprintDocument)(
      document.file,
      owner.signal,
    )
  } catch {
    // Let the owning reader present unreadable/unsupported file errors locally.
  }
  if (owner.signal.aborted) return
  const previous = sessions.active
  await sessions.open(
    document,
    { panel: props.initialPanel, query: props.initialSearchQuery },
    fingerprint,
  )
  if (!owner.signal.aborted && sessions.active === previous) publishActive()
}
async function activate(id: string) {
  opening?.abort()
  const previous = sessions.active
  await sessions.activate(id).catch(reportOpenFailure)
  if (sessions.active === previous) publishActive()
}
async function close(id: string) {
  opening?.abort()
  const previous = sessions.active
  await sessions.close(id).catch(reportOpenFailure)
  if (sessions.active === previous) publishActive()
}
watch(
  () => [props.document, props.request] as const,
  ([document]) => {
    opening?.abort()
    if (document) void open(document).catch(reportOpenFailure)
    else if (!props.persistent) void sessions.reset().catch(reportOpenFailure)
  },
  // Read restore context after Vue has patched all sibling props, before rendering.
  { immediate: true, flush: 'pre' },
)
onBeforeUnmount(() => {
  disposed = true
  opening?.abort()
  void sessions.reset().catch(reportOpenFailure)
})
function restoreWorkspace(saved: WorkspaceTabs) {
  opening?.abort()
  return sessions.restoreWorkspace(saved)
}
async function disconnectSources() {
  opening?.abort()
  for (const session of sessions.sessions.values()) await sessions.disconnect(session.id)
}
async function reset() {
  opening?.abort()
  await sessions.reset()
}
defineExpose({
  sessions,
  activate,
  close,
  restoreWorkspace,
  disconnectSources,
  reset,
  snapshot: () => sessions.snapshot(),
})
</script>

<template>
  <div v-if="selected" class="session-workspace">
    <div
      v-for="owner in readers"
      :id="`${owner.session.id}-panel`"
      :key="`${owner.session.id}:${owner.generation}`"
      role="tabpanel"
      :aria-labelledby="`${owner.session.id}-tab`"
      tabindex="0"
      :inert="owner.session.id !== selected || undefined"
      :aria-hidden="owner.session.id !== selected || undefined"
      class="session-panel"
      :class="{ 'session-inactive': owner.session.id !== selected }"
    >
      <component
        :is="owner.document.format === 'PDF' ? PdfReaderWorkspace : EpubReaderWorkspace"
        :ref="(runtime: unknown) => attach(runtime, owner)"
        :document="owner.document"
        :id-prefix="`${owner.session.id}-`"
        :initial-state="owner.session.state"
        :active="owner.session.id === selected"
        @reading-change="emit('snapshotChange')"
        @phase-change="sessions.update(owner.session.id, owner.generation, $event)"
        @status="current(owner) && emit('status', $event)"
        @identity="identity(owner, $event)"
        @recent-ready="current(owner) && emit('recentReady', $event)"
        @utility-change="(panel: UtilityPanel, query: string) => utility(owner, panel, query)"
      />
    </div>
    <div
      v-if="!active"
      :id="`${selected}-panel`"
      role="tabpanel"
      :aria-labelledby="`${selected}-tab`"
      tabindex="0"
      class="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted"
    >
      <h1 :id="`${selected}-reader-title`" class="text-base font-semibold text-ink">
        {{ panels.find((panel) => panel.id === selected)?.title }}
      </h1>
      <p role="status">
        {{
          reconnect
            ? 'This saved document needs local access. Reselect its source to verify and restore your reading position. Missing or changed files stay disconnected.'
            : 'Opening document…'
        }}
      </p>
      <button
        v-if="reconnect"
        type="button"
        class="pt-list-entry rounded-md border border-line px-4 py-2 text-ink hover:bg-canvas"
        @click="emit('recover')"
      >
        Reconnect local document
      </button>
    </div>
    <template v-for="panel in panels" :key="panel.id">
      <div
        v-if="panel.id !== selected && !readers.some((owner) => owner.session.id === panel.id)"
        :id="`${panel.id}-panel`"
        role="tabpanel"
        :aria-labelledby="`${panel.id}-tab`"
        hidden
      />
    </template>
  </div>
  <slot v-else />
</template>
<style scoped>
.session-workspace {
  position: relative;
  height: 100%;
  min-height: 0;
  isolation: isolate;
}
.session-panel {
  height: 100%;
  min-height: 0;
}
.session-inactive {
  position: absolute;
  inset: 0;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
</style>

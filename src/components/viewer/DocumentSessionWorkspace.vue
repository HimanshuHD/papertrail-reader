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
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  document: DiscoveredDocument | null
  request?: number
  initialPanel?: UtilityPanel
  initialSearchQuery?: string
}>()
const emit = defineEmits<{
  status: [message: string]
  change: [tabs: DocumentSession[], selectedId: string | null]
  activeChange: [document: DiscoveredDocument | null, fingerprint: string | null]
  identity: [fingerprint: string]
  recentReady: [identity: { id: string; fingerprint: string }]
  utilityChange: [panel: UtilityPanel, query: string]
}>()
const active = shallowRef<ActiveSession | null>(null)
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
  panels.value = [...sessions.sessions.values()].filter((item) => item.phase !== 'closed')
  emit(
    'change',
    [...sessions.sessions.values()]
      .filter((item) => item.phase !== 'closed')
      .map((item) => ({ ...item })),
    sessions.selectedId,
  )
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
}
function attach(runtime: unknown, owner: ActiveSession) {
  if (runtime) sessions.attach(owner.session.id, owner.generation, runtime as SessionRuntime)
}
function current(owner: ActiveSession) {
  return sessions.owns(owner.session.id, owner.generation)
}
function identity(owner: ActiveSession, fingerprint: string) {
  if (sessions.update(owner.session.id, owner.generation, 'ready', fingerprint))
    emit('identity', fingerprint)
}
function releaseFailed() {
  emit(
    'status',
    'The previous reader could not be released. Reload the workspace before opening another document.',
  )
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
  await sessions.activate(id).catch(releaseFailed)
  if (sessions.active === previous) publishActive()
}
async function close(id: string) {
  opening?.abort()
  const previous = sessions.active
  await sessions.close(id).catch(releaseFailed)
  if (sessions.active === previous) publishActive()
}
watch(
  () => [props.document, props.request] as const,
  ([document]) => {
    opening?.abort()
    if (document) void open(document).catch(releaseFailed)
    else void sessions.reset().catch(releaseFailed)
  },
  // Read restore context after Vue has patched all sibling props, before rendering.
  { immediate: true, flush: 'pre' },
)
onBeforeUnmount(() => {
  disposed = true
  opening?.abort()
  void sessions.reset().catch(releaseFailed)
})
defineExpose({ sessions, activate, close })
</script>

<template>
  <div
    v-if="selected"
    :id="`${selected}-panel`"
    role="tabpanel"
    :aria-labelledby="`${selected}-tab`"
    tabindex="0"
    class="session-panel"
  >
    <template
      v-for="owner in active ? [active] : []"
      :key="`${owner.session.id}:${owner.generation}`"
    >
      <component
        :is="owner.document.format === 'PDF' ? PdfReaderWorkspace : EpubReaderWorkspace"
        :ref="(runtime: unknown) => attach(runtime, owner)"
        :document="owner.document"
        :initial-state="owner.session.state"
        @phase-change="sessions.update(owner.session.id, owner.generation, $event)"
        @status="current(owner) && emit('status', $event)"
        @identity="identity(owner, $event)"
        @recent-ready="current(owner) && emit('recentReady', $event)"
        @utility-change="(panel: UtilityPanel, query: string) => utility(owner, panel, query)"
      />
    </template>
    <p v-if="!active" role="status" class="p-4 text-sm text-muted">
      {{
        reconnect
          ? 'Local access is unavailable. Use + to reselect the source.'
          : 'Opening document…'
      }}
    </p>
  </div>
  <slot v-else />
  <template v-for="panel in panels" :key="panel.id">
    <div
      v-if="panel.id !== selected"
      :id="`${panel.id}-panel`"
      role="tabpanel"
      :aria-labelledby="`${panel.id}-tab`"
      hidden
    />
  </template>
</template>

<style scoped>
.session-panel {
  height: 100%;
  min-height: 0;
}
</style>

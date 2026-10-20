<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
  comparisonChange: [ids: [string, string] | null]
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
const panels = shallowRef<DocumentSession[]>([])
const root = ref<HTMLElement | null>(null)
const comparison = shallowRef<[string, string] | null>(null)
const visible = shallowRef<string[]>([])
const compact = ref(true)
const comparedPanels = computed(
  () =>
    comparison.value
      ?.map((id) => panels.value.find((panel) => panel.id === id))
      .filter((panel): panel is DocumentSession => !!panel) ?? [],
)
let observer: ResizeObserver | undefined
let disposed = false
const sessions = new DocumentSessions(() => {
  if (disposed) return
  selected.value = sessions.selectedId
  comparison.value = sessions.comparison ? [...sessions.comparison] : null
  visible.value = sessions.visibleIds
  compact.value = sessions.comparisonCompact
  emit('comparisonChange', comparison.value)
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
  if (!sessions.retainedOwns(owner.session.id, owner.generation)) return
  owner.session.state.panel = panel
  owner.session.state.query = query
  if (current(owner)) emit('utilityChange', panel, query)
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
  observer?.disconnect()
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
function focusPane(id: string, moveFocus = false) {
  if (!sessions.visibleIds.includes(id) && !sessions.comparison?.includes(id)) return
  if (id === sessions.selectedId && !moveFocus) return
  void activate(id).then(async () => {
    if (moveFocus) {
      await nextTick()
      document.getElementById(`${id}-panel`)?.focus({ preventScroll: true })
    }
  })
}
async function compareWith(id: string) {
  opening?.abort()
  if (!sessions.compareWith(id)) return
  await nextTick()
  document.getElementById(`${sessions.selectedId}-panel`)?.focus({ preventScroll: true })
}
async function endComparison() {
  sessions.endComparison()
  await nextTick()
  document.getElementById(`${sessions.selectedId}-tab`)?.focus({ preventScroll: true })
}
watch(
  root,
  (element) => {
    observer?.disconnect()
    if (!element) return
    const measure = () => sessions.setComparisonCompact(element.getBoundingClientRect().width < 960)
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(element)
    }
  },
  { flush: 'post' },
)
function order(id: string) {
  return comparison.value?.indexOf(id) ?? 0
}
defineExpose({
  sessions,
  compareWith,
  endComparison,
  activate,
  close,
  restoreWorkspace,
  disconnectSources,
  reset,
  snapshot: () => sessions.snapshot(),
})
</script>

<template>
  <div v-if="selected" ref="root" class="session-workspace">
    <div
      v-if="comparison"
      class="comparison-controls border-b border-line bg-panel"
      aria-label="Split view controls"
      role="group"
    >
      <button
        v-for="(panel, index) in comparedPanels"
        :key="panel.id"
        type="button"
        class="comparison-document pt-plain-control"
        :aria-pressed="selected === panel.id"
        :aria-label="`${compact ? 'Show' : 'Focus'} ${index === 0 ? 'left' : 'right'} split view document: ${panel.title}`"
        @click="focusPane(panel.id, true)"
      >
        {{ panel.title }}
      </button>
      <button
        type="button"
        class="comparison-action pt-plain-control"
        aria-label="Swap split view panes"
        @click="sessions.swapComparison()"
      >
        Swap
      </button>
      <button type="button" class="comparison-action pt-plain-control" @click="endComparison">
        Exit split view
      </button>
      <p class="sr-only" role="status">
        {{
          compact
            ? 'Split view shows one document at a time. Choose a document to switch.'
            : 'Split view shows two documents side by side. Focus a pane for shortcuts and reading time.'
        }}
      </p>
    </div>
    <div class="session-readers" :class="{ 'comparison-wide': comparison && !compact }">
      <div
        v-for="owner in readers"
        :id="`${owner.session.id}-panel`"
        :key="`${owner.session.id}:${owner.generation}`"
        :role="comparison?.includes(owner.session.id) ? 'region' : 'tabpanel'"
        :aria-label="
          comparison?.includes(owner.session.id)
            ? `${owner.session.title} split view pane`
            : undefined
        "
        :aria-labelledby="
          comparison?.includes(owner.session.id) ? undefined : `${owner.session.id}-tab`
        "
        tabindex="0"
        :inert="!visible.includes(owner.session.id) || undefined"
        :aria-hidden="!visible.includes(owner.session.id) || undefined"
        class="session-panel"
        :style="{ order: order(owner.session.id) }"
        :class="{
          'session-inactive': !visible.includes(owner.session.id),
          'comparison-pane': comparison?.includes(owner.session.id),
          'comparison-focused':
            comparison?.includes(owner.session.id) && selected === owner.session.id,
        }"
        @pointerdown.capture="focusPane(owner.session.id)"
        @focusin="focusPane(owner.session.id)"
      >
        <component
          :is="owner.document.format === 'PDF' ? PdfReaderWorkspace : EpubReaderWorkspace"
          :ref="(runtime: unknown) => attach(runtime, owner)"
          :document="owner.document"
          :id-prefix="`${owner.session.id}-`"
          :initial-state="owner.session.state"
          :active="owner.session.id === selected"
          @focus-pane="visible.includes(owner.session.id) && focusPane(owner.session.id)"
          @reading-change="emit('snapshotChange')"
          @phase-change="sessions.update(owner.session.id, owner.generation, $event)"
          @status="current(owner) && emit('status', $event)"
          @identity="identity(owner, $event)"
          @recent-ready="current(owner) && emit('recentReady', $event)"
          @utility-change="(panel: UtilityPanel, query: string) => utility(owner, panel, query)"
        />
      </div>
      <template v-for="panel in panels" :key="panel.id">
        <div
          v-if="!readers.some((owner) => owner.session.id === panel.id)"
          :id="`${panel.id}-panel`"
          :role="comparison?.includes(panel.id) ? 'region' : 'tabpanel'"
          :aria-label="
            comparison?.includes(panel.id) ? `${panel.title} split view pane` : undefined
          "
          :aria-labelledby="comparison?.includes(panel.id) ? undefined : `${panel.id}-tab`"
          tabindex="0"
          :inert="!visible.includes(panel.id) || undefined"
          :aria-hidden="!visible.includes(panel.id) || undefined"
          class="session-panel session-placeholder"
          :style="{ order: order(panel.id) }"
          :class="{
            'session-inactive': !visible.includes(panel.id),
            'comparison-pane': comparison?.includes(panel.id),
            'comparison-focused': comparison?.includes(panel.id) && selected === panel.id,
          }"
          @pointerdown.capture="focusPane(panel.id)"
          @focusin="focusPane(panel.id)"
        >
          <h1 :id="`${panel.id}-reader-title`" class="text-base font-semibold text-ink">
            {{ panel.title }}
          </h1>
          <p role="status">
            {{
              panel.phase === 'reconnect'
                ? 'This saved document needs local access. Reselect its source to verify and restore your reading position. Missing or changed files stay disconnected.'
                : 'Opening document…'
            }}
          </p>
          <button
            v-if="panel.phase === 'reconnect'"
            type="button"
            class="pt-list-entry rounded-md border border-line px-4 py-2 text-ink hover:bg-canvas"
            @click="emit('recover')"
          >
            Reconnect local document
          </button>
        </div>
      </template>
    </div>
  </div>
  <slot v-else />
</template>
<style scoped>
.session-workspace {
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  min-height: 0;
  isolation: isolate;
}
.session-readers {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.comparison-wide {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.session-panel {
  position: relative;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.session-inactive {
  position: absolute;
  inset: 0;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
.session-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  text-align: center;
  font-size: 14px;
  color: var(--pt-muted);
}
.comparison-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  min-width: 0;
  min-height: 36px;
  flex-shrink: 0;
  font-size: 12px;
}
.comparison-document {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 6px;
  border-bottom: 2px solid transparent;
  border-radius: 4px;
}
.comparison-document[aria-pressed='true'] {
  color: var(--pt-brand);
  border-bottom-color: var(--pt-brand);
}
.comparison-action {
  flex-shrink: 0;
  padding: 6px;
  border-radius: 4px;
}
.comparison-pane {
  outline: 1px solid var(--pt-line);
  outline-offset: -1px;
}
.comparison-focused {
  outline: 2px solid var(--pt-brand);
  outline-offset: -2px;
}
.comparison-pane :deep(.pdf-side-panel) {
  position: absolute;
  width: min(21rem, 100%);
  box-shadow: -8px 0 24px #0002;
}
</style>

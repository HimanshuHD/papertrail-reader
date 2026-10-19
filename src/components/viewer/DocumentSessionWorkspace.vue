<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import PdfReaderWorkspace from './PdfReaderWorkspace.vue'
import EpubReaderWorkspace from './EpubReaderWorkspace.vue'
import {
  DocumentSessions,
  type ActiveSession,
  type SessionRuntime,
  type UtilityPanel,
} from '../../features/reader/document-sessions'
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  document: DiscoveredDocument | null
  initialPanel?: UtilityPanel
  initialSearchQuery?: string
}>()
const emit = defineEmits<{
  status: [message: string]
  identity: [fingerprint: string]
  recentReady: [identity: { id: string; fingerprint: string }]
  utilityChange: [panel: UtilityPanel, query: string]
}>()
const active = shallowRef<ActiveSession | null>(null)
const sessions = new DocumentSessions(() => {
  active.value = sessions.active
})
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
watch(
  () => props.document,
  (document) => {
    if (document)
      void sessions
        .open(document, { panel: props.initialPanel, query: props.initialSearchQuery })
        .catch(releaseFailed)
    else void sessions.reset().catch(releaseFailed)
  },
  // Read restore context after Vue has patched all sibling props, before rendering.
  { immediate: true, flush: 'pre' },
)
onBeforeUnmount(() => {
  void sessions.reset().catch(releaseFailed)
})
defineExpose({ sessions })
</script>

<template>
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
      @utility-change="
        (panel: UtilityPanel, query: string) =>
          current(owner) && emit('utilityChange', panel, query)
      "
    />
  </template>
  <slot v-if="!active" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiIcon from '../UiIcon.vue'
import type { ReadingStatistics } from '../../services/reading-statistics'
const props = withDefaults(
  defineProps<{
    annotations?: readonly { note: string }[]
    annotationsAvailable?: boolean
    annotationsLoading?: boolean
    summary: ReadingStatistics | null
    activeMs: number
    idle: boolean
    notice: string
    resetting: boolean
    positionLabel: string
    position: number
    reset: () => Promise<void>
    retry: () => void
  }>(),
  { annotations: () => [], annotationsAvailable: false, annotationsLoading: false },
)
const emit = defineEmits<{ seeAnnotations: [] }>()
const noteCount = computed(
  () => props.annotations.filter((annotation) => annotation.note.trim()).length,
)
const confirming = ref(false)
const time = computed(() => {
  const seconds = Math.floor(props.activeMs / 1000)
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : `${seconds}s`
})
async function clear() {
  await props.reset()
  confirming.value = false
}
</script>
<template>
  <section class="min-h-0 flex-1 overflow-auto p-5" aria-label="Local reading insights">
    <p v-if="notice" role="alert" class="mb-4 text-sm text-muted">
      {{ notice }}
      <button class="pt-framed-control ml-1 rounded-lg px-2 py-1" @click="retry">Retry</button>
    </p>
    <div class="rounded-2xl border border-line bg-canvas p-4">
      <p class="text-xs font-medium text-muted">Active reading time</p>
      <p class="mt-2 text-3xl font-semibold text-ink">{{ time }}</p>
      <p class="mt-2 text-xs text-muted">
        {{ idle ? 'Paused for inactivity' : 'Counts while this reader is visible and focused' }}
      </p>
    </div>
    <dl class="mt-5 space-y-4 text-sm">
      <div>
        <dt class="text-muted">{{ positionLabel }}</dt>
        <dd class="mt-1 font-medium">{{ Math.round(position * 100) }}%</dd>
      </div>
      <div>
        <dt class="text-muted">Furthest {{ positionLabel.toLowerCase() }}</dt>
        <dd class="mt-1 font-medium">{{ Math.round((summary?.furthestPosition ?? 0) * 100) }}%</dd>
      </div>
      <div>
        <dt class="text-muted">Reading visits</dt>
        <dd class="mt-1 font-medium">{{ summary?.visits ?? 0 }}</dd>
      </div>
    </dl>
    <div class="mt-5 rounded-2xl border border-line bg-canvas p-4">
      <p class="text-xs font-medium text-muted">This document’s annotations</p>
      <p v-if="annotationsLoading" class="mt-3 text-sm text-muted" role="status">
        Loading annotations…
      </p>
      <dl v-else-if="annotationsAvailable" class="mt-3 grid grid-cols-2 gap-4">
        <div>
          <dt class="text-xs text-muted">Highlights</dt>
          <dd class="mt-1 text-2xl font-semibold" data-testid="highlight-count">
            {{ annotations.length }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Notes</dt>
          <dd class="mt-1 text-2xl font-semibold" data-testid="note-count">{{ noteCount }}</dd>
        </div>
      </dl>
      <p v-else class="mt-3 text-sm text-muted" role="status">Annotation counts unavailable.</p>
      <button
        class="pt-framed-control mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
        @click="emit('seeAnnotations')"
      >
        <UiIcon name="annotations" class="h-4 w-4" /> See annotations
      </button>
    </div>
    <p class="mt-5 text-xs leading-relaxed text-muted">
      Position is navigation progress, not a completion claim. Time pauses after 60 seconds without
      interaction. Insights stay in this browser.
    </p>
    <button
      v-if="!confirming"
      class="pt-framed-control mt-5 rounded-lg px-3 py-2 text-sm"
      :disabled="!summary || resetting"
      @click="confirming = true"
    >
      Reset this document’s insights
    </button>
    <div v-else class="mt-5 rounded-xl border border-line p-3">
      <p class="text-sm">
        Reset reading time and visits? Your reading position, bookmarks and notes will stay.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          class="pt-framed-control rounded-lg px-3 py-2 text-sm"
          :disabled="resetting"
          @click="clear"
        >
          {{ resetting ? 'Resetting…' : 'Reset insights' }}</button
        ><button
          class="pt-framed-control rounded-lg px-3 py-2 text-sm"
          :disabled="resetting"
          @click="confirming = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </section>
</template>

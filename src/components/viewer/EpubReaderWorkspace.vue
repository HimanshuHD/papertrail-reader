<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { DiscoveredDocument } from '../../features/library/discovery'
import { useEpubReader } from '../../composables/useEpubReader'
import { useThemeStore } from '../../stores/theme'

const props = defineProps<{ document: DiscoveredDocument }>()
const emit = defineEmits<{ status: [message: string] }>()
const reader = useEpubReader()
const host = ref<HTMLElement | null>(null)
const theme = useThemeStore()
async function open() {
  const file = props.document.file
  await nextTick()
  if (host.value) await reader.open(file, host.value, theme.resolvedTheme === 'dark')
}
watch(() => props.document.file, open, { immediate: true })
watch(
  () => theme.resolvedTheme,
  (mode) => reader.session.value?.appearance(mode === 'dark'),
)
watch(
  () => reader.error.value,
  (error) => {
    if (error) emit('status', error)
  },
)
watch(
  () => reader.session.value,
  (session) => {
    if (session) emit('status', `Opened local EPUB: ${session.title}.`)
  },
)
</script>

<template>
  <section class="epub-reader min-w-0 bg-canvas" aria-label="EPUB reader">
    <header class="border-b border-line bg-panel p-3">
      <div class="epub-heading">
        <h2 id="reader-title" class="truncate text-sm font-semibold">
          {{ reader.session.value?.title || document.name }}
        </h2>
        <p class="my-2 text-xs text-muted">Text reader · Book images and styling are omitted.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="rounded border border-line px-3 py-2 text-sm disabled:opacity-40"
          :disabled="reader.busy.value || !reader.session.value || reader.chapter.value === 0"
          @click="reader.go(reader.chapter.value - 1)"
        >
          Previous chapter
        </button>
        <label class="sr-only" for="epub-chapter">Chapter</label>
        <select
          id="epub-chapter"
          class="min-w-0 max-w-full rounded border border-line bg-panel p-2 text-sm"
          :value="reader.chapter.value"
          :disabled="reader.busy.value || !reader.session.value"
          @change="reader.go(Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="(chapter, index) in reader.session.value?.chapters"
            :key="chapter.href"
            :value="index"
          >
            {{ chapter.label }}
          </option>
        </select>
        <button
          class="rounded border border-line px-3 py-2 text-sm disabled:opacity-40"
          :disabled="
            reader.busy.value ||
            !reader.session.value ||
            reader.chapter.value >= reader.session.value.chapters.length - 1
          "
          @click="reader.go(reader.chapter.value + 1)"
        >
          Next chapter
        </button>
      </div>
    </header>
    <p v-if="reader.busy.value" class="p-3 text-sm text-muted" role="status">Opening EPUB text…</p>
    <div v-if="reader.error.value" class="p-4" role="alert">
      <p>{{ reader.error.value }}</p>
      <button class="mt-3 rounded border border-line px-3 py-2" @click="open">
        Retry opening EPUB
      </button>
    </div>
    <div ref="host" class="epub-host min-h-0 flex-1" :aria-busy="reader.busy.value" />
  </section>
</template>

<style scoped>
.epub-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.epub-host {
  position: relative;
  overflow: hidden;
}
</style>

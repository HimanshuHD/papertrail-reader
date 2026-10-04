<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { DiscoveredDocument } from '../../features/library/discovery'
import { useEpubReader } from '../../composables/useEpubReader'
import { useThemeStore } from '../../stores/theme'
import EpubContentsList from './EpubContentsList.vue'
import { flattenContents, type EpubContentsEntry } from '../../features/epub/navigation'
import {
  DEFAULT_EPUB_TYPOGRAPHY,
  EPUB_FONT_SIZES,
  EPUB_LINE_SPACING,
  EPUB_READING_WIDTHS,
  type EpubTypography,
} from '../../features/epub/typography'

const props = defineProps<{ document: DiscoveredDocument }>()
const emit = defineEmits<{ status: [message: string] }>()
const reader = useEpubReader()
const host = ref<HTMLElement | null>(null)
const theme = useThemeStore()
const textOnly = ref(false)
const typography = ref<EpubTypography>({ ...DEFAULT_EPUB_TYPOGRAPHY })
const currentContentsId = computed(
  () =>
    reader.contentsEntry.value ??
    flattenContents(reader.session.value?.contents ?? []).find(
      (entry) => entry.chapter === reader.chapter.value,
    )?.id,
)
function selectContents(entry: EpubContentsEntry) {
  if (entry.chapter !== null) void reader.go(entry.chapter, entry.fragment, entry.id)
}
function applyTypography() {
  reader.session.value?.typography(typography.value)
}
function resetTypography() {
  typography.value = { ...DEFAULT_EPUB_TYPOGRAPHY }
  applyTypography()
}
async function open(preserve = false) {
  const file = props.document.file
  const chapter = preserve ? reader.chapter.value : 0
  const position = preserve ? reader.session.value?.position?.() : undefined
  await nextTick()
  if (file === props.document.file && host.value)
    await reader.open(file, host.value, theme.resolvedTheme === 'dark', {
      textOnly: textOnly.value,
      chapter,
      position,
      typography: typography.value,
    })
}
watch(
  () => props.document.file,
  () => {
    textOnly.value = false
    typography.value = { ...DEFAULT_EPUB_TYPOGRAPHY }
    void open()
  },
  { immediate: true },
)
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
        <p v-if="textOnly" class="my-2 text-xs text-muted">Book images and styling are omitted.</p>
      </div>
      <div class="epub-controls">
        <label for="epub-chapter" class="text-sm">Chapters</label>
        <select
          id="epub-chapter"
          class="min-w-0 rounded border border-line bg-panel p-2 text-sm"
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
        <label class="flex items-center gap-2 text-sm">
          <input
            v-model="textOnly"
            type="checkbox"
            :disabled="reader.busy.value || !reader.session.value"
            @change="open(true)"
          />
          Text-only view
        </label>
      </div>
      <div class="epub-settings">
        <details class="epub-settings-section">
          <summary class="cursor-pointer rounded py-2 text-sm">Contents</summary>
          <p v-if="reader.session.value?.contentsSource === 'spine'" class="text-xs text-muted">
            Chapter order
          </p>
          <nav aria-label="EPUB contents" class="epub-contents border border-line rounded text-sm">
            <EpubContentsList
              :entries="reader.session.value?.contents ?? []"
              :current-id="currentContentsId"
              :busy="reader.busy.value"
              @select="selectContents"
            />
          </nav>
        </details>
        <details class="epub-settings-section">
          <summary class="cursor-pointer rounded py-2 text-sm">Typography</summary>
          <fieldset
            class="epub-typography border border-line rounded p-2"
            :disabled="reader.busy.value || !reader.session.value"
          >
            <legend class="sr-only">EPUB typography</legend>
            <label
              >Font size
              <select
                v-model="typography.fontSize"
                class="rounded border border-line bg-panel p-2"
                @change="applyTypography"
              >
                <option :value="null">Book default</option>
                <option v-for="size in EPUB_FONT_SIZES" :key="size" :value="size">
                  {{ size }} px
                </option>
              </select>
            </label>
            <label
              >Line spacing
              <select
                v-model="typography.lineSpacing"
                class="rounded border border-line bg-panel p-2"
                @change="applyTypography"
              >
                <option :value="null">Book default</option>
                <option v-for="spacing in EPUB_LINE_SPACING" :key="spacing" :value="spacing">
                  {{ spacing }}
                </option>
              </select>
            </label>
            <label
              >Reading width
              <select
                v-model="typography.readingWidth"
                class="rounded border border-line bg-panel p-2"
                @change="applyTypography"
              >
                <option :value="null">Full width</option>
                <option v-for="width in EPUB_READING_WIDTHS" :key="width" :value="width">
                  {{ width }} px
                </option>
              </select>
            </label>
            <button type="button" class="rounded border border-line p-2" @click="resetTypography">
              Reset typography
            </button>
          </fieldset>
        </details>
      </div>
    </header>
    <p v-if="reader.busy.value" class="p-3 text-sm text-muted" role="status">Opening EPUB…</p>
    <div v-if="reader.error.value" class="p-4" role="alert">
      <p>{{ reader.error.value }}</p>
      <button class="mt-3 rounded border border-line px-3 py-2" @click="open()">
        Retry opening EPUB
      </button>
    </div>
    <div class="epub-stage">
      <div ref="host" class="epub-host" :aria-busy="reader.busy.value" />
      <button
        class="epub-step epub-previous rounded border border-line bg-panel disabled:opacity-40"
        aria-label="Previous chapter"
        title="Previous chapter"
        :disabled="reader.busy.value || !reader.session.value || reader.chapter.value === 0"
        @click="reader.go(reader.chapter.value - 1)"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <button
        class="epub-step epub-next rounded border border-line bg-panel disabled:opacity-40"
        aria-label="Next chapter"
        title="Next chapter"
        :disabled="
          reader.busy.value ||
          !reader.session.value ||
          reader.chapter.value >= reader.session.value.chapters.length - 1
        "
        @click="reader.go(reader.chapter.value + 1)"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
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
.epub-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.epub-controls select {
  flex: 1;
  max-width: 24rem;
}
.epub-reader > header {
  flex-shrink: 0;
  max-height: 50%;
  overflow-y: auto;
}
.epub-settings {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}
.epub-settings-section {
  min-width: 0;
  flex: 1;
  min-inline-size: min(100%, 12rem);
}
.epub-settings summary:focus-visible,
.epub-typography button:focus-visible,
.epub-typography select:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.epub-contents {
  max-height: min(14rem, 28vh);
  overflow-y: auto;
  overflow-x: hidden;
}
.epub-typography {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.875rem;
}
.epub-typography label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.epub-typography select {
  min-width: 0;
  max-width: 100%;
}
.epub-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.epub-step {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 44px;
  display: grid;
  place-items: center;
}
.epub-step:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.epub-previous {
  left: 2px;
}
.epub-next {
  right: 2px;
}
.epub-host {
  min-width: 0;
  position: absolute;
  inset: 0 40px;
  overflow: hidden;
}
.epub-host :deep(.epub-container) {
  max-width: 100%;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}
</style>

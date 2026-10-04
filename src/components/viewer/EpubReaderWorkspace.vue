<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { DiscoveredDocument } from '../../features/library/discovery'
import { useEpubReader } from '../../composables/useEpubReader'
import { useThemeStore } from '../../stores/theme'
import LoadingState from '../LoadingState.vue'
import { useEpubContinuity } from '../../composables/useEpubContinuity'
import { useEpubBookmarks } from '../../composables/useEpubBookmarks'
import EpubBookmarksPanel from './EpubBookmarksPanel.vue'
import { normalizeLocation } from '../../features/epub/location'
import type { EpubReadingSettings, EpubBookmark } from '../../services/epub-reading-storage'
import type { EpubSession } from '../../features/epub/epub-session'
import IconButton from '../IconButton.vue'
import { hideTransitionSurface, restoreTransitionSurface } from '../../services/transition-surface'
import EpubContentsList from './EpubContentsList.vue'
import { flattenContents, type EpubContentsEntry } from '../../features/epub/navigation'
import {
  DEFAULT_EPUB_TYPOGRAPHY,
  fontSteps,
  readingWidthOptions,
  type EpubTypography,
} from '../../features/epub/typography'

const props = defineProps<{ document: DiscoveredDocument }>()
const emit = defineEmits<{
  status: [message: string]
  identity: [fingerprint: string]
  recentReady: [identity: { id: string; fingerprint: string }]
}>()
const continuity = useEpubContinuity(captureReading)
const reader = useEpubReader()
const bookmarks = useEpubBookmarks(continuity.documentId)
let openGeneration = 0
const host = ref<HTMLElement | null>(null)
const theme = useThemeStore()
const textOnly = ref(false)
const root = ref<HTMLElement | null>(null)
const rightPanel = ref<'contents' | 'bookmarks' | null>(null)
const typographyOpen = ref(false)
const popover = ref<HTMLElement | null>(null)
const lineOptions = [
  { label: 'Book default', value: null },
  { label: 'Compact', value: 1.4 },
  { label: 'Comfortable', value: 1.8 },
  { label: 'Spacious', value: 2 },
]
const windowWidth = ref(globalThis.innerWidth)
const widthOptions = computed(() => readingWidthOptions(windowWidth.value))
const bookFontSize = ref(18)
const steps = computed(() => fontSteps(bookFontSize.value))
const fontIndex = computed(() =>
  steps.value.findIndex((step) => step.value === typography.value.fontSize),
)
const metadata = shallowRef<Pick<
  EpubSession,
  'title' | 'chapters' | 'contents' | 'contentsSource'
> | null>(null)
const showLoader = ref(false)
const restoringContentsEntry = ref<string | null>(null)
let loaderTimer: ReturnType<typeof setTimeout> | undefined
function updateWindowWidth() {
  windowWidth.value = globalThis.innerWidth
}
watch(windowWidth, () => {
  const previousWidth = typography.value.readingWidth
  if (windowWidth.value < 640) typography.value.readingWidth = null
  else if (windowWidth.value < 1024 && typography.value.readingWidth === 800)
    typography.value.readingWidth = 640
  if (previousWidth !== typography.value.readingWidth) applyTypography()
})
const frameDocuments = new Set<Document>()
function onFramePointer() {
  closeTypography(false)
}
function onFrameKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (typographyOpen.value) {
    event.preventDefault()
    closeTypography()
  } else if (rightPanel.value) {
    event.preventDefault()
    closePanel()
  }
}
let readingContainer: HTMLElement | null = null
function captureReading(): EpubReadingSettings | undefined {
  if (!reader.session.value || reader.busy.value) return
  return {
    textOnly: textOnly.value,
    typography: { ...typography.value },
    location: reader.session.value.location?.(),
  }
}
function saveReading() {
  continuity.save()
}
function clearFrameListeners() {
  readingContainer?.removeEventListener('scroll', saveReading)
  readingContainer = null
  for (const doc of frameDocuments) {
    doc.removeEventListener('pointerdown', onFramePointer, true)
    doc.removeEventListener('keydown', onFrameKey, true)
  }
  frameDocuments.clear()
}
function bindFrameListeners() {
  clearFrameListeners()
  readingContainer = host.value?.querySelector<HTMLElement>('.epub-container') ?? null
  readingContainer?.addEventListener('scroll', saveReading, { passive: true })
  for (const frame of host.value?.querySelectorAll('iframe') ?? []) {
    const doc = frame.contentDocument
    if (!doc) continue
    doc.addEventListener('pointerdown', onFramePointer, true)
    doc.addEventListener('keydown', onFrameKey, true)
    frameDocuments.add(doc)
  }
}
watch(
  () => reader.busy.value || continuity.preparing.value,
  async (busy) => {
    clearTimeout(loaderTimer)
    showLoader.value = false
    if (busy)
      loaderTimer = setTimeout(() => {
        showLoader.value = true
      }, 150)
    else {
      await nextTick()
      bindFrameListeners()
      bookFontSize.value = reader.session.value?.defaultFontSize?.() ?? 18
    }
  },
  { immediate: true },
)
const loading = computed(() => reader.busy.value || continuity.preparing.value)
const unavailable = computed(() => loading.value || !reader.session.value)
function focusAction(label: string) {
  void nextTick(() =>
    root.value
      ?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
      ?.focus({ preventScroll: true }),
  )
}
function closeTypography(focus = true) {
  typographyOpen.value = false
  if (focus) focusAction('Typography')
}
function closePanel() {
  const label = rightPanel.value === 'bookmarks' ? 'Bookmarks' : 'Contents'
  rightPanel.value = null
  focusAction(label)
}
async function togglePanel(panel: 'contents' | 'bookmarks' = 'contents') {
  closeTypography(false)
  if (rightPanel.value === panel) return closePanel()
  rightPanel.value = panel
  await nextTick()
  root.value
    ?.querySelector<HTMLButtonElement>('button[aria-label="Close utility panel"]')
    ?.focus({ preventScroll: true })
}
async function toggleTypography() {
  if (typographyOpen.value) return closeTypography()
  typographyOpen.value = true
  await nextTick()
  popover.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !root.value?.contains(event.target as Node)) return
  if (typographyOpen.value) closeTypography()
  else if (rightPanel.value) closePanel()
  else return
  event.preventDefault()
}
function onPointer(event: PointerEvent) {
  const target = event.target as Node
  if (
    typographyOpen.value &&
    !popover.value?.contains(target) &&
    !root.value?.querySelector('button[aria-label="Typography"]')?.contains(target)
  )
    closeTypography(false)
}
onMounted(() => {
  globalThis.addEventListener('keydown', onKey)
  globalThis.addEventListener('pointerdown', onPointer, true)
  globalThis.addEventListener('resize', updateWindowWidth)
})
onBeforeUnmount(() => {
  ++openGeneration
  globalThis.removeEventListener('keydown', onKey)
  globalThis.removeEventListener('pointerdown', onPointer, true)
  globalThis.removeEventListener('resize', updateWindowWidth)
  clearTimeout(loaderTimer)
  clearFrameListeners()
})
function changeFont(delta: number) {
  typography.value.fontSize =
    steps.value[Math.max(0, Math.min(steps.value.length - 1, fontIndex.value + delta))]!.value
  applyTypography()
}
function setSpacing(value: number | null) {
  typography.value.lineSpacing = value
  applyTypography()
}
function setWidth(value: number | null) {
  typography.value.readingWidth = value
  applyTypography()
}
const typography = ref<EpubTypography>({ ...DEFAULT_EPUB_TYPOGRAPHY })
const currentContentsId = computed(
  () =>
    reader.contentsEntry.value ??
    (reader.busy.value ? restoringContentsEntry.value : null) ??
    flattenContents(metadata.value?.contents ?? []).find(
      (entry) => entry.chapter === reader.chapter.value,
    )?.id,
)
function selectContents(entry: EpubContentsEntry) {
  if (entry.chapter !== null) void reader.go(entry.chapter, entry.fragment, entry.id)
}
function applyTypography() {
  reader.session.value?.typography(typography.value)
  continuity.save()
}
function resetTypography() {
  typography.value = { ...DEFAULT_EPUB_TYPOGRAPHY }
  applyTypography()
}
function toggleTextOnly() {
  textOnly.value = !textOnly.value
  void open(true)
}
async function navigateBookmark(bookmark: EpubBookmark) {
  if (!(await reader.restore(bookmark.location))) {
    bookmarks.notice.value = 'This saved place is unavailable. You can continue reading.'
  } else continuity.save()
}
async function addBookmark(name: string) {
  const location = reader.session.value?.location?.()
  if (!location) {
    bookmarks.notice.value =
      'The current reading place could not be determined. Try again after the chapter loads.'
    return false
  }
  return bookmarks.add(name, location)
}
async function open(preserve = false) {
  const file = props.document.file
  const owner = ++openGeneration
  const contentsEntry = reader.contentsEntry.value
  restoringContentsEntry.value = preserve ? contentsEntry : null
  let saved: EpubReadingSettings | null = null
  if (!preserve) {
    saved = await continuity.prepare(file)
    if (owner !== openGeneration || file !== props.document.file) return
    if (saved) {
      textOnly.value = saved.textOnly
      typography.value = { ...saved.typography }
      if (windowWidth.value < 640) typography.value.readingWidth = null
      else if (windowWidth.value < 1024 && typography.value.readingWidth === 800)
        typography.value.readingWidth = 640
    }
  }
  await nextTick()
  if (owner === openGeneration && file === props.document.file && host.value) {
    await (preserve ? reader.reopen : reader.open)(
      file,
      host.value,
      theme.resolvedTheme === 'dark',
      {
        ...(!preserve
          ? { chapter: 0, ...(saved?.location ? { location: saved.location } : {}) }
          : {}),
        textOnly: textOnly.value,
        typography: typography.value,
      },
    )
    if (owner !== openGeneration || file !== props.document.file || !reader.session.value) return
    if (preserve) reader.contentsEntry.value = contentsEntry
    if (saved?.location && !normalizeLocation(saved.location, reader.session.value.chapters.length))
      continuity.notice.value = 'The saved chapter is unavailable. Reading starts at the beginning.'
    continuity.save()
    if (continuity.fingerprint.value) {
      emit('identity', continuity.fingerprint.value)
      emit('recentReady', {
        id: continuity.documentId.value ?? `epub:${continuity.fingerprint.value}`,
        fingerprint: continuity.fingerprint.value,
      })
    }
  }
}
watch(
  () => props.document.file,
  () => {
    continuity.reset()
    reader.close()
    restoringContentsEntry.value = null
    metadata.value = null
    bookFontSize.value = 18
    rightPanel.value = null
    typographyOpen.value = false
    textOnly.value = false
    typography.value = { ...DEFAULT_EPUB_TYPOGRAPHY }
    void open()
  },
  { immediate: true, flush: 'sync' },
)
watch(
  () => reader.chapter.value,
  () => {
    void nextTick(saveReading)
  },
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
    if (session) {
      metadata.value = {
        title: session.title,
        chapters: session.chapters,
        contents: session.contents,
        contentsSource: session.contentsSource,
      }
      emit('status', `Opened local EPUB: ${session.title}.`)
    }
  },
)
</script>

<template>
  <section ref="root" class="epub-reader min-w-0 bg-canvas" aria-label="EPUB reader">
    <header
      class="epub-header relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 sm:px-6"
    >
      <div class="min-w-0 flex-1 basis-40">
        <h2
          id="reader-title"
          class="truncate text-base font-semibold sm:text-lg"
          :title="document.name"
        >
          {{ metadata?.title || document.name }}
        </h2>
        <p v-if="metadata" class="mt-1 text-xs text-muted">
          Chapter {{ reader.chapter.value + 1 }} of {{ metadata.chapters.length }}
          <span v-if="textOnly"> · Text-only view</span>
        </p>
      </div>
      <div
        class="flex min-w-0 flex-wrap items-center justify-end gap-1"
        aria-label="EPUB reader controls"
      >
        <button
          type="button"
          role="switch"
          aria-label="Text-only view"
          :aria-checked="textOnly"
          :disabled="unavailable"
          class="epub-mode-switch"
          @click="toggleTextOnly"
        >
          <span aria-hidden="true" class="epub-switch-track"><span /></span>
          <span>Text-only view</span>
        </button>
        <IconButton
          label="Typography"
          icon="typography"
          :disabled="unavailable"
          :active="typographyOpen"
          :aria-expanded="typographyOpen"
          aria-controls="epub-typography"
          @click="toggleTypography"
        />
        <IconButton
          label="Bookmarks"
          icon="bookmark"
          :disabled="unavailable"
          :active="rightPanel === 'bookmarks'"
          :aria-expanded="rightPanel === 'bookmarks'"
          aria-controls="epub-utility-panel"
          @click="togglePanel('bookmarks')"
        />
        <IconButton
          label="Contents"
          icon="contents"
          :disabled="unavailable"
          :active="rightPanel === 'contents'"
          :aria-expanded="rightPanel === 'contents'"
          aria-controls="epub-utility-panel"
          @click="togglePanel('contents')"
        />
      </div>
      <Transition
        name="utility-popover"
        @before-enter="restoreTransitionSurface"
        @before-leave="hideTransitionSurface"
      >
        <section
          v-if="typographyOpen"
          id="epub-typography"
          ref="popover"
          class="epub-popover rounded-2xl border border-line bg-panel p-4 shadow-2xl"
          aria-labelledby="epub-typography-title"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 id="epub-typography-title" class="text-sm font-semibold">Typography</h3>
            <IconButton label="Close typography" icon="close" @click="closeTypography()" />
          </div>
          <fieldset class="space-y-4" :disabled="unavailable">
            <legend class="sr-only">EPUB typography</legend>
            <div>
              <p class="mb-2 text-xs font-medium text-muted">Font size</p>
              <div
                class="flex items-center justify-between rounded-lg border border-line bg-canvas p-1"
              >
                <IconButton
                  label="Decrease font size"
                  icon="zoom-out"
                  :disabled="unavailable || fontIndex === 0"
                  @click="changeFont(-1)"
                />
                <output aria-label="Font size" class="text-sm font-medium" aria-live="polite">{{
                  typography.fontSize === null
                    ? `Book default (${bookFontSize} px)`
                    : `${typography.fontSize} px`
                }}</output>
                <IconButton
                  label="Increase font size"
                  icon="zoom-in"
                  :disabled="unavailable || fontIndex === steps.length - 1"
                  @click="changeFont(1)"
                />
              </div>
            </div>
            <div role="group" aria-label="Line spacing">
              <p class="mb-2 text-xs font-medium text-muted">Line spacing</p>
              <div class="epub-segments">
                <button
                  v-for="option in lineOptions"
                  :key="option.label"
                  type="button"
                  :aria-pressed="typography.lineSpacing === option.value"
                  @click="setSpacing(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div v-if="widthOptions.length" role="group" aria-label="Reading width">
              <p class="mb-2 text-xs font-medium text-muted">Reading width</p>
              <div class="epub-segments">
                <button
                  v-for="option in widthOptions"
                  :key="option.label"
                  type="button"
                  :aria-pressed="typography.readingWidth === option.value"
                  @click="setWidth(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <button type="button" class="epub-reset" @click="resetTypography">
              Reset typography
            </button>
          </fieldset>
        </section>
      </Transition>
    </header>

    <div v-if="reader.error.value" class="p-4" role="alert">
      <p>{{ reader.error.value }}</p>
      <button class="mt-3 rounded border border-line px-3 py-2" @click="open()">
        Retry opening EPUB
      </button>
    </div>
    <div class="epub-body">
      <div class="epub-stage">
        <p
          v-if="continuity.notice.value"
          role="status"
          class="absolute inset-x-12 bottom-2 z-10 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted"
        >
          {{ continuity.notice.value }}
        </p>
        <div
          ref="host"
          class="epub-host"
          :class="{ 'epub-host-loading': loading }"
          :aria-busy="loading"
          :inert="loading || undefined"
          @load.capture="bindFrameListeners"
        />
        <div v-if="loading" class="epub-loading-cover" aria-busy="true">
          <LoadingState
            v-if="showLoader"
            :label="metadata ? 'Loading chapter…' : 'Opening EPUB…'"
            detail="Preparing your reading space"
          />
          <span v-else class="sr-only" role="status">Loading EPUB content…</span>
        </div>
        <button
          class="epub-step epub-previous disabled:opacity-40"
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
          class="epub-step epub-next disabled:opacity-40"
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
      <Transition
        name="utility-panel"
        @before-enter="restoreTransitionSurface"
        @before-leave="hideTransitionSurface"
      >
        <aside
          v-if="rightPanel"
          id="epub-utility-panel"
          class="epub-side-panel border-l border-line bg-panel"
          aria-label="EPUB utility panel"
        >
          <div class="flex items-center justify-between gap-2 border-b border-line p-3">
            <h3 class="text-sm font-semibold">
              {{ rightPanel === 'bookmarks' ? 'Bookmarks' : 'Contents' }}
            </h3>
            <IconButton label="Close utility panel" icon="close" @click="closePanel" />
          </div>
          <p
            v-if="rightPanel === 'contents' && metadata?.contentsSource === 'spine'"
            class="px-3 pt-3 text-xs text-muted"
          >
            Chapter order
          </p>
          <nav
            v-if="rightPanel === 'contents'"
            aria-label="EPUB contents"
            class="epub-contents p-3 text-sm"
          >
            <EpubContentsList
              :entries="metadata?.contents ?? []"
              :current-id="currentContentsId"
              :busy="reader.busy.value"
              @select="selectContents"
            />
          </nav>
          <EpubBookmarksPanel
            v-else
            :bookmarks="bookmarks.bookmarks.value"
            :available="bookmarks.available.value"
            :busy="bookmarks.busy.value || unavailable"
            :loading="bookmarks.loading.value"
            :notice="bookmarks.notice.value"
            :current-chapter="reader.chapter.value + 1"
            :total-chapters="metadata?.chapters.length ?? 0"
            :add="addBookmark"
            :rename="bookmarks.rename"
            :remove="bookmarks.remove"
            @navigate="navigateBookmark"
            @retry="bookmarks.reload"
          />
        </aside>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.epub-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.5rem;
  font-size: 0.75rem;
  min-height: 44px;
}
.epub-mode-switch:disabled {
  opacity: 0.5;
}
.epub-mode-switch:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
  border-radius: 0.5rem;
}
.epub-switch-track {
  display: flex;
  align-items: center;
  width: 2.25rem;
  height: 1.25rem;
  padding: 2px;
  border-radius: 1rem;
  background: var(--pt-line);
}
.epub-switch-track span {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--pt-panel);
  transition: transform 150ms ease;
}
.epub-mode-switch[aria-checked='true'] .epub-switch-track {
  background: var(--pt-brand);
}
.epub-mode-switch[aria-checked='true'] .epub-switch-track span {
  transform: translateX(1rem);
}
.epub-host-loading {
  visibility: hidden;
}
.epub-loading-cover {
  position: absolute;
  inset: 0 40px;
  z-index: 2;
  background: var(--pt-canvas);
}
.epub-header > [aria-label='EPUB reader controls'] :deep(.icon-button:hover),
.epub-header > [aria-label='EPUB reader controls'] :deep(.icon-button:focus-visible) {
  z-index: 60;
}
.epub-step {
  border: 0;
  background: transparent;
  border-radius: 50%;
  color: var(--pt-muted);
  transition:
    color 150ms ease,
    transform 150ms ease;
}
.epub-step:hover:not(:disabled) {
  color: var(--pt-brand);
  transform: translateY(-50%) scale(1.12);
}
.epub-step:active:not(:disabled) {
  transform: translateY(-50%) scale(0.95);
}
.epub-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.epub-reader {
  container-type: inline-size;
}
.epub-header {
  flex-shrink: 0;
}
.epub-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.epub-popover {
  position: absolute;
  top: 100%;
  right: 0.75rem;
  z-index: 50;
  margin-top: 0.5rem;
  width: min(22rem, calc(100% - 1.5rem));
  max-height: min(32rem, 65dvh);
  overflow: auto;
}
.epub-segments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  border: 1px solid var(--pt-line);
  border-radius: 0.75rem;
  padding: 0.25rem;
  background: var(--pt-canvas);
}
.epub-segments button,
.epub-reset {
  min-height: 2.5rem;
  border-radius: 0.5rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.epub-segments button[aria-pressed='true'] {
  background: var(--pt-panel);
  color: var(--pt-brand);
  box-shadow: 0 0 0 1px var(--pt-line);
}
.epub-segments button:hover,
.epub-reset:hover {
  background: var(--pt-panel);
}
.epub-segments button:focus-visible,
.epub-reset:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
.epub-reset {
  width: 100%;
  border: 1px solid var(--pt-line);
}
.epub-popover fieldset:disabled {
  opacity: 0.5;
}
.epub-side-panel {
  position: absolute;
  z-index: 10;
  inset: 0 0 0 auto;
  display: flex;
  flex-direction: column;
  width: min(20rem, 100%);
  min-width: 0;
  box-shadow: -8px 0 24px #0002;
}
.epub-contents {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}
@container (min-width: 900px) {
  .epub-side-panel {
    position: relative;
    flex: 0 0 19rem;
    box-shadow: none;
  }
}
.utility-panel-leave-active {
  position: absolute;
  inset: 0 0 0 auto;
  pointer-events: none;
}
.utility-panel-enter-active,
.utility-panel-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}
.utility-panel-enter-from,
.utility-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.utility-popover-enter-active,
.utility-popover-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
  transform-origin: top right;
}
.utility-popover-enter-from,
.utility-popover-leave-to {
  transform: translateY(-0.5rem);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .epub-step,
  .epub-switch-track span {
    transition: none;
  }
  .utility-panel-enter-active,
  .utility-panel-leave-active,
  .utility-popover-enter-active,
  .utility-popover-leave-active {
    transition: none;
  }
}
.epub-stage {
  min-width: 0;
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

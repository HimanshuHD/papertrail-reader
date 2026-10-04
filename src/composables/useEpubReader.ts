import { nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { normalizeLocation, type EpubLocation } from '../features/epub/location'
import {
  openEpubSession,
  type EpubSession,
  type EpubOpenOptions,
} from '../features/epub/epub-session'

export function useEpubReader() {
  const session = shallowRef<EpubSession | null>(null)
  const busy = ref(false)
  const error = ref('')
  const chapter = ref(0)
  const contentsEntry = ref<string | null>(null)
  let controller: AbortController | null = null
  let operation = 0
  let activeFile: File | null = null
  function close() {
    ++operation
    controller?.abort()
    controller = null
    session.value?.destroy()
    session.value = null
    busy.value = false
    activeFile = null
  }
  async function open(
    file: File,
    target: HTMLElement,
    dark: boolean,
    options: EpubOpenOptions = {},
  ) {
    close()
    activeFile = file
    const owner = operation
    controller = new AbortController()
    const signal = controller.signal
    busy.value = true
    error.value = ''
    chapter.value = options.chapter ?? 0
    contentsEntry.value = null
    try {
      const result = await openEpubSession(file, target, signal, options)
      if (owner !== operation) {
        result.destroy()
        return
      }
      chapter.value =
        normalizeLocation(options.location, result.chapters.length)?.chapter ??
        Math.max(0, Math.min(chapter.value, result.chapters.length - 1))
      session.value = result
      result.appearance(dark)
    } catch (reason) {
      if (owner !== operation || signal.aborted) return
      error.value = reason instanceof Error ? reason.message : 'This EPUB could not be opened.'
    } finally {
      if (owner === operation) busy.value = false
    }
  }
  async function go(index: number, fragment?: string, entryId?: string) {
    const current = session.value
    const owner = operation
    if (!current || busy.value || !current.chapters[index]) return
    busy.value = true
    await nextTick()
    if (owner !== operation) return
    try {
      if (fragment) await current.display(index, fragment)
      else await current.display(index)
      if (owner === operation) {
        chapter.value = index
        contentsEntry.value = entryId ?? null
        error.value = ''
      }
    } catch {
      if (owner === operation)
        error.value = 'This chapter could not be displayed. Try opening the document again.'
    } finally {
      if (owner === operation) busy.value = false
    }
  }
  async function reopen(file: File, target: HTMLElement, dark: boolean, options: EpubOpenOptions) {
    const current = file === activeFile ? session.value : null
    const location = current?.location?.()
    const selected = current ? contentsEntry.value : null
    const chapterIndex = current ? chapter.value : 0
    const position = current?.position?.()
    const owner = operation + 1
    await open(file, target, dark, {
      ...options,
      chapter: chapterIndex,
      position,
      ...(location ? { location } : {}),
    })
    if (owner === operation && session.value) contentsEntry.value = selected
  }
  async function restore(location: EpubLocation) {
    const current = session.value
    const owner = operation
    if (!current?.restore || busy.value) return false
    busy.value = true
    await nextTick()
    if (owner !== operation) return false
    try {
      const restored = await current.restore(location)
      if (owner !== operation) return false
      if (restored) {
        chapter.value = location.chapter
        contentsEntry.value = null
        error.value = ''
      }
      return restored
    } catch {
      if (owner === operation) error.value = 'This reading location could not be restored.'
      return false
    } finally {
      if (owner === operation) busy.value = false
    }
  }
  onBeforeUnmount(close)
  return { session, busy, error, chapter, contentsEntry, open, reopen, restore, go, close }
}

import { onBeforeUnmount, ref, shallowRef } from 'vue'
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
  function close() {
    ++operation
    controller?.abort()
    controller = null
    session.value?.destroy()
    session.value = null
    busy.value = false
  }
  async function open(
    file: File,
    target: HTMLElement,
    dark: boolean,
    options: EpubOpenOptions = {},
  ) {
    close()
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
      chapter.value = Math.max(0, Math.min(chapter.value, result.chapters.length - 1))
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
  onBeforeUnmount(close)
  return { session, busy, error, chapter, contentsEntry, open, go, close }
}

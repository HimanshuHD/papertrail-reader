import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { openEpubSession, type EpubSession } from '../features/epub/epub-session'

export function useEpubReader() {
  const session = shallowRef<EpubSession | null>(null)
  const busy = ref(false)
  const error = ref('')
  const chapter = ref(0)
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
  async function open(file: File, target: HTMLElement, dark: boolean) {
    close()
    const owner = operation
    controller = new AbortController()
    const signal = controller.signal
    busy.value = true
    error.value = ''
    chapter.value = 0
    try {
      const result = await openEpubSession(file, target, signal)
      if (owner !== operation) {
        result.destroy()
        return
      }
      session.value = result
      result.appearance(dark)
    } catch (reason) {
      if (owner !== operation || signal.aborted) return
      error.value = reason instanceof Error ? reason.message : 'This EPUB could not be opened.'
    } finally {
      if (owner === operation) busy.value = false
    }
  }
  async function go(index: number) {
    const current = session.value
    const owner = operation
    if (!current || busy.value || !current.chapters[index]) return
    busy.value = true
    try {
      await current.display(index)
      if (owner === operation) {
        chapter.value = index
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
  return { session, busy, error, chapter, open, go, close }
}

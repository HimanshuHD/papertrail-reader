import { onBeforeUnmount, ref } from 'vue'
import { fingerprintDocument } from '../services/document-identity'
import { IndexedDbReadingStorage, type ReadingStorage } from '../services/reading-storage'

/** Coordinates async identity/storage; components own navigation and rendering. */
export function useReadingContinuity(storage: ReadingStorage = new IndexedDbReadingStorage()) {
  const notice = ref('')
  let generation = 0
  let controller: AbortController | null = null
  let identity: string | null = null
  let pending: { id: string; page: number } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let writes = Promise.resolve()

  function flush() {
    clearTimeout(timer)
    const next = pending
    pending = null
    if (!next) return
    const owner = generation
    writes = writes
      .then(() => storage.save(next.id, next.page))
      .catch(() => {
        if (owner === generation)
          notice.value = 'Your reading position could not be saved. You can continue reading.'
      })
  }

  function reset() {
    flush()
    generation += 1
    controller?.abort()
    identity = null
    notice.value = ''
  }

  async function restore(file: File, totalPages: number): Promise<number | null> {
    reset()
    const owner = generation
    const abort = new AbortController()
    controller = abort
    try {
      const fingerprint = await fingerprintDocument(file, abort.signal)
      await writes
      if (owner !== generation) return null
      const match = await storage.resolve(fingerprint, file.name)
      if (owner !== generation) return null
      if (match.ambiguous) {
        notice.value =
          'Multiple saved identities match this PDF. Reading starts at page 1; saved positions were preserved.'
        return null
      }
      identity = match.record.id
      return Math.min(totalPages, Math.max(1, match.record.page))
    } catch {
      if (owner === generation && !abort.signal.aborted)
        notice.value = 'Reading position storage is unavailable. You can continue reading.'
      return null
    }
  }

  function save(page: number) {
    if (!identity) return
    pending = { id: identity, page }
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  }

  const hide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  globalThis.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', hide)
  onBeforeUnmount(() => {
    reset()
    globalThis.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', hide)
  })
  return { notice, restore, save, reset }
}

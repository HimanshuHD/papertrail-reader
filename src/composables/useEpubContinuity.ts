import { onBeforeUnmount, ref } from 'vue'
import {
  fingerprintEpub,
  IndexedDbEpubReadingStorage,
  normalizeEpubSettings,
  type EpubReadingSettings,
  type EpubReadingStorage,
} from '../services/epub-reading-storage'

export function useEpubContinuity(
  capture: () => EpubReadingSettings | undefined,
  storage: EpubReadingStorage = new IndexedDbEpubReadingStorage(),
) {
  const notice = ref('')
  const documentId = ref<string | null>(null)
  const fingerprint = ref<string | null>(null)
  const preparing = ref(false)
  let generation = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { id: string; settings: EpubReadingSettings; owner: number } | undefined
  let writes = Promise.resolve()
  function flush() {
    clearTimeout(timer)
    const next = pending
    pending = undefined
    if (!next) return
    writes = writes
      .then(() => storage.save(next.id, next.settings))
      .catch(() => {
        if (generation === next.owner)
          notice.value = 'Your EPUB reading position could not be saved. You can continue reading.'
      })
  }
  function save(settings = capture()) {
    if (!documentId.value || !settings) return
    pending = { id: documentId.value, settings: normalizeEpubSettings(settings), owner: generation }
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  }
  function reset() {
    save()
    flush()
    ++generation
    controller?.abort()
    documentId.value = null
    fingerprint.value = null
    preparing.value = false
    notice.value = ''
  }
  async function prepare(file: File) {
    reset()
    const owner = generation
    const abort = new AbortController()
    controller = abort
    preparing.value = true
    try {
      const digest = await fingerprintEpub(file, abort.signal)
      await writes
      if (owner !== generation) return null
      fingerprint.value = digest
      const match = await storage.resolve(digest, file.name)
      if (owner !== generation) return null
      if (match.ambiguous) {
        notice.value =
          'Saved EPUB metadata is ambiguous or unsupported. Reading starts fresh; existing metadata was preserved.'
        return null
      }
      documentId.value = match.record.id
      return normalizeEpubSettings(match.record)
    } catch {
      if (owner === generation && !abort.signal.aborted)
        notice.value = 'EPUB reading storage is unavailable. You can continue reading.'
      return null
    } finally {
      if (owner === generation) preparing.value = false
    }
  }
  const exit = () => {
    save()
    flush()
  }
  const hide = () => {
    if (document.visibilityState === 'hidden') exit()
  }
  globalThis.addEventListener('pagehide', exit)
  document.addEventListener('visibilitychange', hide)
  onBeforeUnmount(() => {
    reset()
    globalThis.removeEventListener('pagehide', exit)
    document.removeEventListener('visibilitychange', hide)
  })
  return { notice, documentId, fingerprint, preparing, prepare, save, flush, reset }
}

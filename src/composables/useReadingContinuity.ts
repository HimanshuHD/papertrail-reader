import { onBeforeUnmount, ref } from 'vue'
import {
  normalizePdfView,
  normalizePdfAnchor,
  type PdfReadingAnchor,
  type PdfReadingState,
  type PdfViewSettings,
} from '../services/pdf-reading-state'
import { fingerprintDocument } from '../services/document-identity'
import { IndexedDbReadingStorage, type ReadingStorage } from '../services/reading-storage'

/** Coordinates async identity/storage; components own navigation and rendering. */
export function useReadingContinuity(storage: ReadingStorage = new IndexedDbReadingStorage()) {
  const notice = ref('')
  const fingerprint = ref<string | null>(null)
  let generation = 0
  let controller: AbortController | null = null
  const documentId = ref<string | null>(null)
  let pending: {
    id: string
    page: number
    view: PdfViewSettings
    anchor?: PdfReadingAnchor
  } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let writes = Promise.resolve()

  function flush() {
    clearTimeout(timer)
    const next = pending
    pending = null
    if (!next) return
    const owner = generation
    writes = writes
      .then(() =>
        next.anchor
          ? storage.save(next.id, next.page, next.view, next.anchor)
          : storage.save(next.id, next.page, next.view),
      )
      .catch(() => {
        if (owner === generation)
          notice.value = 'Your reading position could not be saved. You can continue reading.'
      })
  }

  function reset() {
    flush()
    generation += 1
    controller?.abort()
    documentId.value = null
    fingerprint.value = null
    notice.value = ''
  }

  async function restore(file: File, totalPages: number): Promise<PdfReadingState | null> {
    reset()
    const owner = generation
    const abort = new AbortController()
    controller = abort
    try {
      const digest = await fingerprintDocument(file, abort.signal)
      await writes
      if (owner !== generation) return null
      fingerprint.value = digest
      const match = await storage.resolve(digest, file.name)
      if (owner !== generation) return null
      if (match.ambiguous) {
        notice.value =
          'Multiple saved identities match this PDF. Reading starts at page 1; saved positions were preserved.'
        return null
      }
      documentId.value = match.record.id
      return {
        page: Math.min(totalPages, Math.max(1, match.record.page)),
        view: normalizePdfView(match.record.view),
        ...(normalizePdfAnchor(match.record.anchor, totalPages)
          ? { anchor: normalizePdfAnchor(match.record.anchor, totalPages) }
          : {}),
      }
    } catch {
      if (owner === generation && !abort.signal.aborted)
        notice.value = 'Reading position storage is unavailable. You can continue reading.'
      return null
    }
  }

  function save(page: number, view?: PdfViewSettings, anchor?: PdfReadingAnchor) {
    if (!documentId.value) return
    pending = {
      id: documentId.value,
      page,
      view: normalizePdfView(view),
      anchor: normalizePdfAnchor(anchor),
    }
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
  return { notice, fingerprint, documentId, restore, save, reset }
}

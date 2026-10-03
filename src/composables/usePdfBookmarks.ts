import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import {
  IndexedDbBookmarkStorage,
  type BookmarkStorage,
  type PdfBookmark,
} from '../services/pdf-bookmarks'
import type { PdfReadingAnchor } from '../services/pdf-reading-state'

export function usePdfBookmarks(
  documentId: Ref<string | null>,
  storage: BookmarkStorage = new IndexedDbBookmarkStorage(),
) {
  const bookmarks = shallowRef<PdfBookmark[]>([])
  const loading = ref(false)
  const busy = ref(false)
  const available = ref(false)
  const notice = ref('')
  let generation = 0
  let operations = Promise.resolve()

  async function load() {
    const owner = ++generation
    const id = documentId.value
    bookmarks.value = []
    available.value = false
    busy.value = false
    notice.value = ''
    loading.value = Boolean(id)
    if (!id) return
    try {
      const result = await storage.load(id)
      if (owner !== generation) return
      bookmarks.value = result
      available.value = true
    } catch {
      if (owner === generation)
        notice.value =
          'Bookmarks could not be loaded. Retry, or reselect this PDF if storage was cleared.'
    } finally {
      if (owner === generation) loading.value = false
    }
  }
  watch(documentId, load, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    generation += 1
  })

  function mutate(run: (id: string) => Promise<PdfBookmark[]>, message: string) {
    const owner = generation
    const id = documentId.value
    if (!id || !available.value || loading.value || busy.value) return Promise.resolve(false)
    busy.value = true
    notice.value = ''
    const task = operations.then(async () => {
      if (owner !== generation) return false
      try {
        const result = await run(id)
        if (owner !== generation) return false
        bookmarks.value = result
        notice.value = message
        return true
      } catch {
        if (owner === generation)
          notice.value =
            'The bookmark change could not be saved. Retry, or reselect this PDF if storage was cleared.'
        return false
      } finally {
        if (owner === generation) busy.value = false
      }
    })
    operations = task.then(() => undefined)
    return task
  }
  return {
    bookmarks,
    loading,
    busy,
    available,
    notice,
    reload: load,
    add: (name: string, anchor: PdfReadingAnchor) =>
      mutate((id) => storage.add(id, name, anchor), 'Bookmark saved.'),
    rename: (bookmarkId: string, name: string) =>
      mutate((id) => storage.rename(id, bookmarkId, name), 'Bookmark renamed.'),
    remove: (bookmarkId: string) =>
      mutate((id) => storage.remove(id, bookmarkId), 'Bookmark removed.'),
  }
}

import { onBeforeUnmount, ref } from 'vue'
import {
  IndexedDbRecentStorage,
  type RecentDocument,
  type RecentStorage,
} from '../services/recent-documents'

export function useRecentDocuments(storage: RecentStorage = new IndexedDbRecentStorage()) {
  const entries = ref<RecentDocument[]>([])
  const notice = ref('')
  const busy = ref(false)
  let active = true
  let pending = 0
  let writes = Promise.resolve()
  function run(action: () => Promise<RecentDocument[]>) {
    pending += 1
    busy.value = true
    writes = writes
      .then(async () => {
        if (!active) return
        try {
          const result = await action()
          if (active) {
            entries.value = result
            notice.value = ''
          }
        } catch {
          if (active)
            notice.value =
              'Recent history could not be saved or loaded. You can continue reading. Retry to reload history.'
        }
      })
      .finally(() => {
        pending -= 1
        if (active) busy.value = pending > 0
      })
    return writes
  }
  void run(() => storage.load())
  onBeforeUnmount(() => {
    active = false
  })
  return {
    entries,
    notice,
    busy,
    reload: () => run(() => storage.load()),
    remember: (entry: RecentDocument) => run(() => storage.remember(entry)),
    remove: (id?: string) => run(() => storage.remove(id)),
  }
}

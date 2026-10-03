import { onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  IndexedDbWorkspaceStorage,
  type WorkspaceSnapshot,
  type WorkspaceStorage,
} from '../services/workspace-storage'
import { restoreDirectoryAccess, type LibraryAccess } from '../services/library-access'

export function useWorkspaceContinuity(
  storage: WorkspaceStorage = new IndexedDbWorkspaceStorage(),
) {
  const snapshot = shallowRef<WorkspaceSnapshot | null>(null)
  const notice = ref('')
  const access = ref<LibraryAccess['status']>('reselect')
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: WorkspaceSnapshot | null = null
  let writes = Promise.resolve()
  let disposed = false

  function flush() {
    clearTimeout(timer)
    const next = pending
    pending = null
    if (!next) return
    const owner = generation
    writes = writes
      .then(() => storage.save(next))
      .catch(() => {
        if (owner === generation && !disposed)
          notice.value = 'Your workspace could not be saved. You can continue reading.'
      })
  }
  function patch(value: Partial<WorkspaceSnapshot>) {
    if (!snapshot.value) return
    snapshot.value = { ...snapshot.value, ...value }
    pending = snapshot.value
    clearTimeout(timer)
    timer = setTimeout(flush, 250)
  }
  function remember(value: WorkspaceSnapshot) {
    generation += 1
    snapshot.value = value
    notice.value = ''
    access.value = 'granted'
    patch({})
  }
  async function restore(
    onMetadata?: (saved: WorkspaceSnapshot) => void,
  ): Promise<LibraryAccess | null> {
    const owner = generation
    try {
      const saved = await storage.load()
      if (owner !== generation || disposed) return null
      snapshot.value = saved
      if (!saved) return null
      onMetadata?.(saved)
      const result = await restoreDirectoryAccess(saved.handle)
      if (owner !== generation || disposed) return null
      access.value = result.status
      return result
    } catch {
      if (owner === generation && !disposed)
        notice.value = 'Saved workspace access is unavailable. Choose your files again to continue.'
      return null
    }
  }
  async function resume(): Promise<LibraryAccess | null> {
    const owner = generation
    const result = await restoreDirectoryAccess(snapshot.value?.handle ?? null, true)
    if (owner !== generation || disposed) return null
    access.value = result.status
    return result
  }
  async function forget() {
    const owner = ++generation
    clearTimeout(timer)
    pending = null
    snapshot.value = null
    access.value = 'reselect'
    writes = writes
      .then(() => storage.clear())
      .then(() => {
        if (owner === generation && !disposed) notice.value = ''
      })
      .catch(() => {
        if (owner === generation && !disposed)
          notice.value = 'The saved workspace could not be removed. Try Forget library again.'
      })
    await writes
  }
  const hide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  globalThis.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', hide)
  onBeforeUnmount(() => {
    disposed = true
    generation += 1
    flush()
    globalThis.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', hide)
  })
  return { snapshot, notice, access, restore, resume, remember, patch, forget }
}

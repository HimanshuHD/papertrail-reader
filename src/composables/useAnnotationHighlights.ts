import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import {
  IndexedDbAnnotationStorage,
  type Annotation,
  type AnnotationHandle,
  type AnnotationStorage,
  type AnnotationColor,
} from '../services/annotation-storage'
import type { AnnotationSelector } from '../features/annotations/selectors'

export function useAnnotationHighlights(
  format: 'PDF' | 'EPUB',
  fingerprint: Ref<string | null>,
  storage: AnnotationStorage = new IndexedDbAnnotationStorage(),
) {
  const highlights = shallowRef<Annotation[]>([])
  const lastCreatedId = ref('')
  const handle = shallowRef<AnnotationHandle | null>(null)
  const notice = ref(''),
    loading = ref(false),
    busy = ref(false)
  let generation = 0
  async function load(preserve = false) {
    const owner = ++generation
    handle.value = null
    if (!preserve) {
      highlights.value = []
      lastCreatedId.value = ''
    }
    notice.value = ''
    busy.value = false
    const digest = fingerprint.value
    loading.value = !!digest
    if (!digest) return
    try {
      const result = await storage.open({ format, fingerprint: digest })
      if (generation !== owner) return
      handle.value = result.handle
      highlights.value = result.annotations
    } catch {
      if (generation === owner)
        notice.value =
          'Annotations could not be loaded. You can continue reading; retry to restore them.'
    } finally {
      if (generation === owner) loading.value = false
    }
  }
  watch(fingerprint, () => load(), { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    generation++
  })
  async function mutate(
    operation: (handle: AnnotationHandle) => Promise<unknown>,
    message: string,
  ) {
    const owner = generation,
      current = handle.value
    if (!current || busy.value || loading.value) return false
    busy.value = true
    notice.value = ''
    let committed = false
    try {
      await operation(current)
      committed = true
      if (owner !== generation) return false
      const result = await storage.list(current)
      if (owner !== generation) return false
      highlights.value = result
      notice.value = message
      return true
    } catch {
      if (owner === generation) {
        handle.value = null
        notice.value = committed
          ? 'The change was saved, but annotations could not be refreshed. Retry annotations before editing again.'
          : 'The annotation change could not be saved. Retry annotations before editing again.'
      }
      return false
    } finally {
      if (owner === generation) busy.value = false
    }
  }
  return {
    highlights,
    lastCreatedId,
    handle,
    notice,
    busy,
    loading,
    reload: () => load(true),
    add: (selector: AnnotationSelector, color: AnnotationColor, note = '') => {
      const owner = generation
      return mutate(
        async (h) => {
          lastCreatedId.value = ''
          const created = await storage.create(h, selector, color, note)
          if (owner === generation) lastCreatedId.value = created.id
          return created
        },
        note ? 'Highlight with note saved.' : 'Highlight saved.',
      )
    },
    saveNote: (id: string, note: string, color?: AnnotationColor) =>
      mutate(
        (h) => storage.update(h, id, color ? { note, color } : { note }),
        note ? 'Note saved.' : 'Note deleted.',
      ),
    recolor: (id: string, color: AnnotationColor) =>
      mutate((h) => storage.update(h, id, { color }), 'Highlight color updated.'),
    remove: (id: string) => mutate((h) => storage.remove(h, id), 'Highlight deleted.'),
  }
}

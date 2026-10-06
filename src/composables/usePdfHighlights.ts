import type { Ref } from 'vue'
import type { AnnotationStorage } from '../services/annotation-storage'
import { useAnnotationHighlights } from './useAnnotationHighlights'

export function usePdfHighlights(fingerprint: Ref<string | null>, storage?: AnnotationStorage) {
  return useAnnotationHighlights('PDF', fingerprint, storage)
}

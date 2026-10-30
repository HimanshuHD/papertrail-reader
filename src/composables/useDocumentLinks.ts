import { nextTick, ref, shallowRef, watch } from 'vue'
import { externalLink, type DocumentLink } from '../features/reader/document-links'
export function useDocumentLinks(active: () => boolean) {
  const pending = shallowRef<{ url: string; origin: HTMLElement } | null>(null),
    notice = ref('')
  function request(link: DocumentLink, origin: HTMLElement) {
    if (!active()) return
    notice.value = ''
    if (link.kind === 'blocked') notice.value = link.message
    else if (link.kind === 'external') {
      const checked = externalLink(link.url)
      if (checked.kind === 'external') pending.value = { url: checked.url, origin }
    }
  }
  async function close() {
    const origin = pending.value?.origin
    pending.value = null
    await nextTick()
    if (active() && origin?.isConnected) origin.focus({ preventScroll: true })
  }
  watch(active, () => {
    pending.value = null
    notice.value = ''
  })
  return { pending, notice, request, close }
}

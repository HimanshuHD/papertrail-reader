import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { expect, it, vi } from 'vitest'
import { useDocumentLinks } from '../../src/composables/useDocumentLinks'

it('restores the owning frame before its link and does not steal focus from a newer request', async () => {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const origin = frame.contentDocument!.createElement('a')
  origin.tabIndex = 0
  frame.contentDocument!.body.append(origin)
  let links!: ReturnType<typeof useDocumentLinks>
  const wrapper = mount({
    setup() {
      links = useDocumentLinks(() => true)
      return () => null
    },
  })
  const frameFocus = vi.spyOn(frame, 'focus')
  const linkFocus = vi.spyOn(origin, 'focus')
  try {
    links.request({ kind: 'external', url: 'https://example.com' }, origin)
    await links.close()
    expect(frameFocus).toHaveBeenCalledOnce()
    expect(linkFocus).toHaveBeenCalledOnce()
    expect(frameFocus.mock.invocationCallOrder[0]).toBeLessThan(
      linkFocus.mock.invocationCallOrder[0]!,
    )
    expect(frame.contentDocument!.activeElement).toBe(origin)
    links.request({ kind: 'external', url: 'https://example.com' }, origin)
    const closing = links.close()
    links.request({ kind: 'external', url: 'https://example.org' }, origin)
    await closing
    await nextTick()
    expect(linkFocus).toHaveBeenCalledOnce()
    expect(links.pending.value?.url).toBe('https://example.org/')
  } finally {
    wrapper.unmount()
    vi.restoreAllMocks()
    frame.remove()
  }
})

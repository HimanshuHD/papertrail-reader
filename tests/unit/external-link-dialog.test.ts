import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import ExternalLinkDialog from '../../src/components/viewer/ExternalLinkDialog.vue'
import { openConfirmedLink } from '../../src/features/reader/document-links'
vi.mock('../../src/features/reader/document-links', () => ({ openConfirmedLink: vi.fn() }))
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value() {
    this.setAttribute('open', '')
  },
})
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value() {
    this.removeAttribute('open')
  },
})
afterEach(() => {
  vi.clearAllMocks()
  document.body.replaceChildren()
})
it('focuses Cancel and neither opens on presentation nor cancellation; only confirmation opens', async () => {
  const wrapper = mount(ExternalLinkDialog, {
    props: { url: 'https://example.com' },
    attachTo: document.body,
  })
  try {
    await nextTick()
    expect(document.activeElement?.textContent).toBe('Cancel')
    expect(openConfirmedLink).not.toHaveBeenCalled()
    ;(document.querySelector('dialog button') as HTMLButtonElement).click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(openConfirmedLink).not.toHaveBeenCalled()
    vi.mocked(openConfirmedLink).mockReturnValueOnce(false).mockReturnValueOnce(true)
    const confirm = document.querySelectorAll<HTMLButtonElement>('dialog button')[1]!
    confirm.click()
    await nextTick()
    expect(document.querySelector('[role=status]')?.textContent).toContain('could not open')
    confirm.click()
    expect(openConfirmedLink).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('close')).toHaveLength(2)
  } finally {
    wrapper.unmount()
  }
})

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
    const buttons = document.querySelectorAll<HTMLButtonElement>('dialog button')
    buttons[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(buttons[1])
    buttons[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(buttons[0])
    ;(document.querySelector('dialog button') as HTMLButtonElement).click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false)
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

import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import FloatingPopover from '../../src/components/FloatingPopover.vue'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
it('flips and clamps expanding content at viewport edges and dismisses outside', async () => {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
    left: 310,
    right: 330,
    top: 570,
    bottom: 590,
  } as DOMRect)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(290)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(240)
  vi.stubGlobal('innerWidth', 320)
  vi.stubGlobal('innerHeight', 600)
  const wrapper = mount(FloatingPopover, {
    props: { anchor },
    slots: { default: '<textarea />' },
    global: { stubs: { teleport: false } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  const popup = document.querySelector<HTMLElement>('.floating-popover')!
  expect(popup.style.left).toBe('22px')
  expect(popup.style.top).toBe('322px')
  await wrapper.setProps({ expanded: true })
  await flushPromises()
  expect(popup.classList.contains('expanded')).toBe(true)
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await flushPromises()
  expect(wrapper.emitted('close')).toEqual([[]])
  vi.unstubAllGlobals()
})
it('does not dismiss for inside pointers and restores trigger focus on Escape', async () => {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  const wrapper = mount(FloatingPopover, {
    props: { anchor },
    slots: { default: '<textarea />' },
    global: { stubs: { teleport: false } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  document.querySelector('textarea')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(wrapper.emitted('close')).toBeUndefined()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(wrapper.emitted('close')).toEqual([[]])
  expect(document.activeElement).toBe(anchor)
})

it('keeps the panel close header clear when an expanded note editor flips upward', async () => {
  const panel = document.createElement('aside')
  panel.innerHTML = '<header>Annotations</header><button>Actions</button>'
  document.body.append(panel)
  const anchor = panel.querySelector('button')!
  vi.spyOn(panel.firstElementChild!, 'getBoundingClientRect').mockReturnValue({
    bottom: 180,
  } as DOMRect)
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
    right: 300,
    top: 210,
    bottom: 230,
  } as DOMRect)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(290)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(450)
  const wrapper = mount(FloatingPopover, {
    props: { anchor, expanded: true },
    global: { stubs: { teleport: false } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  expect(
    Number.parseFloat(document.querySelector<HTMLElement>('.floating-popover')!.style.top),
  ).toBeGreaterThanOrEqual(188)
})

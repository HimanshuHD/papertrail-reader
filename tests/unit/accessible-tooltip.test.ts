import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import IconButton from '../../src/components/IconButton.vue'
import Tabs from '../../src/components/viewer/DocumentTabs.vue'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
it('portals one described tooltip, follows its anchor, replaces older tooltips and dismisses on Escape', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.matches('[role="tooltip"]')
      ? new DOMRect(0, 0, 120, 30)
      : new DOMRect(200, 40, 40, 40)
  })
  const a = mount(IconButton, {
    attachTo: document.body,
    props: { label: 'Zoom in', icon: 'zoom-in' },
  })
  const b = mount(IconButton, {
    attachTo: document.body,
    props: { label: 'Fit width', icon: 'fit-width' },
  })
  wrappers.push(a, b)
  await a.trigger('focus')
  await flushPromises()
  let tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
  expect(tooltip.textContent).toBe('Zoom in')
  expect(tooltip.style.left).toBe('160px')
  expect(tooltip.style.top).toBe('88px')
  expect(a.attributes('aria-describedby')).toBe(tooltip.id)
  expect(a.attributes('title')).toBeUndefined()
  await b.trigger('mouseenter')
  await flushPromises()
  expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
  tooltip = document.querySelector('[role="tooltip"]')!
  expect(tooltip.textContent).toBe('Fit width')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
})
it('exposes a single tab description without a native title and gives close its own accessible button', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: {
      selectedId: 'one',
      tabs: [
        {
          id: 'one',
          sourceId: 'one',
          title: 'Reader.pdf',
          name: 'Reader.pdf',
          format: 'PDF',
          fingerprint: null,
          phase: 'ready',
          state: { panel: null, query: '' },
        },
      ],
    },
  })
  wrappers.push(wrapper)
  const tab = wrapper.get('[role="tab"]')
  expect(tab.attributes('title')).toBeUndefined()
  await tab.trigger('mouseenter')
  await flushPromises()
  const tooltip = document.querySelector('[role="tooltip"]')!
  expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
  expect(tab.attributes('aria-describedby')).toBe(tooltip.id)
  const close = wrapper.get('button[aria-label="Close Reader.pdf"]')
  expect(close.element.parentElement).toBe(tab.element.parentElement)
  await close.trigger('click')
  expect(wrapper.emitted('activate')).toBeUndefined()
  expect(wrapper.emitted('close')).toEqual([['one']])
})

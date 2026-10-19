import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Tabs from '../../src/components/viewer/DocumentTabs.vue'
import type { DocumentSession } from '../../src/features/reader/document-sessions'
function tab(id: string, phase: DocumentSession['phase'] = 'ready'): DocumentSession {
  return {
    id,
    sourceId: id,
    title: `Long title ${id}`,
    name: `${id}.pdf`,
    format: 'PDF',
    fingerprint: id,
    phase,
    state: { panel: null, query: '' },
  }
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
it('uses roving manual activation, full labels and keyboard close without leaking navigation keys', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: { tabs: [tab('a'), tab('b'), tab('c')], selectedId: 'a' },
  })
  const tabs = wrapper.findAll('[role="tab"]')
  expect(tabs.map((item) => item.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
  expect(tabs[0]!.attributes('aria-controls')).toBe('a-panel')
  await tabs[0]!.trigger('keydown', { key: 'ArrowRight' })
  expect(document.activeElement?.id).toBe('b-tab')
  expect(wrapper.emitted('activate')).toBeUndefined()
  expect(tabs[0]!.attributes('aria-selected')).toBe('true')
  await tabs[1]!.trigger('keydown', { key: 'End' })
  expect(document.activeElement?.id).toBe('c-tab')
  await tabs[2]!.trigger('keydown', { key: 'Home' })
  expect(document.activeElement?.id).toBe('a-tab')
  await tabs[0]!.trigger('click')
  expect(wrapper.emitted('activate')).toEqual([['a']])
  await tabs[0]!.trigger('keydown', { key: 'Delete' })
  expect(wrapper.emitted('close')).toEqual([['a']])
  expect(document.activeElement?.id).toBe('b-tab')
  expect(tabs[1]!.attributes('aria-label')).toContain('Long title b')
  wrapper.unmount()
})
it('overflow marks the active document, exposes local error/reconnect states and restores focus on Escape', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: { tabs: [tab('a', 'error'), tab('b', 'reconnect')], selectedId: 'a' },
  })
  await flushPromises()
  await wrapper.get('[aria-label="Open document list"]').trigger('click')
  const items = wrapper.findAll('[role="menuitemradio"]')
  expect(items.map((item) => item.attributes('aria-checked'))).toEqual(['true', 'false'])
  expect(items[0]!.text()).toContain('Unable to open')
  expect(items[1]!.text()).toContain('Reconnect required')
  await items[0]!.trigger('keydown', { key: 'ArrowDown' })
  expect(document.activeElement).toBe(items[1]!.element)
  await items[1]!.trigger('click')
  expect(wrapper.emitted('activate')).toEqual([['b']])
  expect(document.activeElement?.id).toBe('b-tab')
  await flushPromises()
  await wrapper.get('[aria-label="Open document list"]').trigger('click')
  await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
  expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Open document list')
  wrapper.unmount()
})
it('final close delegates focus to the library and removes redundant tab actions', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: { tabs: [tab('a')], selectedId: 'a' },
  })
  const button = wrapper.get('[role="tab"]')
  ;(button.element as HTMLButtonElement).focus()
  await button.trigger('keydown', { key: 'Delete' })
  await wrapper.setProps({ tabs: [], selectedId: null })
  expect(wrapper.emitted('emptyClose')).toHaveLength(1)
  expect(wrapper.find('[aria-label="Add local documents from tabs"]').exists()).toBe(false)
  wrapper.unmount()
})
it('shows overflow only when content cannot fit, including after tabs are closed', async () => {
  const scroll = vi.mocked(
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')!.get!,
  )
  scroll.mockReturnValue(400)
  const wrapper = mount(Tabs, { props: { tabs: [tab('a')], selectedId: 'a' } })
  expect(wrapper.find('[aria-label="Open document list"]').exists()).toBe(false)
  scroll.mockReturnValue(900)
  await wrapper.setProps({ tabs: [tab('a'), tab('b'), tab('c')] })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(wrapper.find('[aria-label="Open document list"]').exists()).toBe(true)
  await flushPromises()
  await wrapper.get('[aria-label="Open document list"]').trigger('click')
  scroll.mockReturnValue(400)
  await wrapper.setProps({ tabs: [tab('a')] })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Open document list"]').exists()).toBe(false)
  wrapper.unmount()
})

it('provides a labelled native close button inside the visual tab without nested interactive elements', async () => {
  const wrapper = mount(Tabs, { props: { tabs: [tab('a'), tab('b')], selectedId: 'a' } })
  const inactive = wrapper.findAll('[role="tab"]')[1]!
  expect(inactive.findAll('button')).toHaveLength(0)
  const close = wrapper.get('button[aria-label="Close Long title b"]')
  expect(close.element.tagName).toBe('BUTTON')
  await close.trigger('click')
  expect(wrapper.emitted('close')).toEqual([['b']])
  expect(wrapper.emitted('activate')).toBeUndefined()
  expect(inactive.find('.file-type-icon').exists()).toBe(true)
  wrapper.unmount()
})

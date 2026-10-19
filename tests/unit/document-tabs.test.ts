import { mount } from '@vue/test-utils'
import { afterEach, expect, it } from 'vitest'
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
afterEach(() => {
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
  await wrapper.get('[aria-label="Open document list"]').trigger('click')
  await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
  expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Open document list')
  wrapper.unmount()
})
it('final close sends focus to add and keeps the empty tab strip usable', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: { tabs: [tab('a')], selectedId: 'a' },
  })
  const button = wrapper.get('[role="tab"]')
  ;(button.element as HTMLButtonElement).focus()
  await button.trigger('keydown', { key: 'Delete' })
  await wrapper.setProps({ tabs: [], selectedId: null })
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Add local documents from tabs')
  expect(wrapper.get('[aria-label="Open document list"]').attributes('disabled')).toBeDefined()
  await wrapper.get('[aria-label="Add local documents from tabs"]').trigger('click')
  expect(wrapper.emitted('add')).toHaveLength(1)
  wrapper.unmount()
})

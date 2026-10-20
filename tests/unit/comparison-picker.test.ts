import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it } from 'vitest'
import Picker from '../../src/components/viewer/ComparisonPicker.vue'
import type { DocumentSession } from '../../src/features/reader/document-sessions'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const tab = (id: string, phase: DocumentSession['phase'] = 'ready'): DocumentSession => ({
  id,
  title: id,
  name: id,
  sourceId: id,
  format: 'PDF',
  fingerprint: id + '-hash',
  phase,
  state: { panel: null, query: '' },
})
it('offers only different verified tabs, focuses its choices and delegates comparison', async () => {
  const wrapper = mount(Picker, {
    attachTo: document.body,
    props: {
      selectedId: 'one',
      tabs: [
        tab('one'),
        tab('two'),
        tab('missing', 'reconnect'),
        { ...tab('unknown'), fingerprint: null },
      ],
    },
  })
  wrappers.push(wrapper)
  await wrapper.get('[aria-label="Compare documents"]').trigger('click')
  await flushPromises()
  const popup = document.querySelector(
    '[role="dialog"][aria-label="Choose a document to compare"]',
  )!
  expect(popup.querySelectorAll('button')).toHaveLength(1)
  expect(document.activeElement?.textContent).toContain('Compare with two')
  ;(popup.querySelector('button') as HTMLButtonElement).click()
  expect(wrapper.emitted('compare')).toEqual([['two']])
})
it('disables comparison when the focused document or all partners lack verified access', async () => {
  const wrapper = mount(Picker, {
    props: { selectedId: 'one', tabs: [tab('one'), tab('two', 'reconnect')] },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('[aria-label="Compare documents"]').attributes('disabled')).toBeDefined()
  await wrapper.setProps({ tabs: [tab('one', 'reconnect'), tab('two')] })
  expect(wrapper.get('[aria-label="Compare documents"]').attributes('disabled')).toBeDefined()
})

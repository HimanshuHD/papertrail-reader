import { config } from '@vue/test-utils'
config.global.stubs.teleport = true
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NoteIndicator from '../../src/components/viewer/NoteIndicator.vue'
it('previews notes as safe text and delegates activation to the reader', async () => {
  const wrapper = mount(NoteIndicator, {
    props: { note: '<img src=x onerror=alert(1)> A local note', label: 'Open note' },
    attrs: { style: { left: 'calc(100% - 40px)', top: '20%' } },
  })
  expect(wrapper.get('.reader-note-indicator').attributes('style')).toContain(
    'left: calc(100% - 40px)',
  )
  expect(wrapper.get('.reader-note-indicator').attributes('style')).toContain('top: 20%')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.get('button').trigger('mouseenter')
  expect(wrapper.get('[role="tooltip"]').text()).toContain('<img')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('activate')).toEqual([[]])
  wrapper.unmount()
})

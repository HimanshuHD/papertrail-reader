import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import IndicatorTargets from '../../src/features/diagnostics/IndicatorTargets.vue'
it('applies explicit provisional operation targets and removes only the selected target', async () => {
  const wrapper = mount(IndicatorTargets)
  await wrapper.findAll('input')[0]!.setValue('200')
  await wrapper.findAll('input')[1]!.setValue('1000')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('apply')?.[0]).toEqual([
    'pdf.render',
    'operations',
    { attentionMs: 200, criticalMs: 1000 },
  ])
  await wrapper.findAll('button')[1]!.trigger('click')
  expect(wrapper.emitted('apply')?.[1]).toEqual(['pdf.render', 'operations', null])
})
it('rejects reversed or non-finite targets without emitting configuration', async () => {
  const wrapper = mount(IndicatorTargets)
  await wrapper.findAll('input')[0]!.setValue('2000')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('apply')).toBeUndefined()
  expect(wrapper.get('[role=alert]').text()).toContain('critical greater than attention')
})

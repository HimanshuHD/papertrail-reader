import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ReadingInsightsPanel from '../../src/components/viewer/ReadingInsightsPanel.vue'
const summary = {
  version: 1 as const,
  id: 'local',
  generation: 'epoch',
  activeMs: 65_000,
  visits: 1,
  lastPosition: 1,
  furthestPosition: 1,
  updatedAt: 1,
}
it('labels coarse EPUB progress, formats foreground time and does not claim completion at the last chapter', () => {
  const wrapper = mount(ReadingInsightsPanel, {
    props: {
      summary,
      activeMs: 65_000,
      idle: true,
      notice: '',
      resetting: false,
      positionLabel: 'Chapter position',
      position: 1,
      reset: vi.fn(),
      retry: vi.fn(),
    },
  })
  expect(wrapper.text()).toContain('1m 5s')
  expect(wrapper.text()).toContain('Chapter position')
  expect(wrapper.text()).toContain('Paused for inactivity')
  expect(wrapper.text()).not.toContain('Completed')
  expect(wrapper.text()).toContain('not a completion claim')
  wrapper.unmount()
})
it('requires explicit reset confirmation and keeps failure recovery actionable', async () => {
  const reset = vi.fn().mockResolvedValue(undefined),
    retry = vi.fn()
  const wrapper = mount(ReadingInsightsPanel, {
    props: {
      summary,
      activeMs: 65_000,
      idle: false,
      notice: 'Storage unavailable',
      resetting: false,
      positionLabel: 'Page position',
      position: 0.5,
      reset,
      retry,
    },
  })
  await wrapper.get('button').trigger('click')
  expect(retry).toHaveBeenCalledOnce()
  await wrapper
    .findAll('button')
    .find((b) => b.text().startsWith('Reset this'))!
    .trigger('click')
  expect(reset).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('bookmarks and notes will stay')
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Reset insights')!
    .trigger('click')
  await flushPromises()
  expect(reset).toHaveBeenCalledOnce()
  wrapper.unmount()
})
it('counts saved highlights and non-empty notes reactively and opens annotations', async () => {
  const wrapper = mount(ReadingInsightsPanel, {
    props: {
      summary,
      activeMs: 0,
      idle: false,
      notice: '',
      resetting: false,
      positionLabel: 'Page position',
      position: 0,
      reset: vi.fn(),
      retry: vi.fn(),
      annotationsAvailable: true,
      annotations: [{ note: 'A note' }, { note: '' }, { note: '   ' }],
    },
  })
  expect(wrapper.get('[data-testid="highlight-count"]').text()).toBe('3')
  expect(wrapper.get('[data-testid="note-count"]').text()).toBe('1')
  await wrapper.setProps({ annotations: [{ note: 'Updated' }, { note: 'Another' }] })
  expect(wrapper.get('[data-testid="highlight-count"]').text()).toBe('2')
  expect(wrapper.get('[data-testid="note-count"]').text()).toBe('2')
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'See annotations')!
    .trigger('click')
  expect(wrapper.emitted('seeAnnotations')).toHaveLength(1)
  await wrapper.setProps({ annotationsLoading: true })
  expect(wrapper.text()).toContain('Loading annotations…')
  expect(wrapper.find('[data-testid="highlight-count"]').exists()).toBe(false)
  await wrapper.setProps({ annotationsLoading: false, annotationsAvailable: false })
  expect(wrapper.text()).toContain('Annotation counts unavailable.')
  expect(wrapper.find('[data-testid="note-count"]').exists()).toBe(false)
  wrapper.unmount()
})

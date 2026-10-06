import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HighlightSelectionToolbar from '../../src/components/viewer/HighlightSelectionToolbar.vue'
import { selectionAnchor, toolbarPosition } from '../../src/features/annotations/selection-toolbar'
it('maps iframe text geometry into the parent viewport', () => {
  const selection = {
    rangeCount: 1,
    isCollapsed: false,
    getRangeAt: () => ({ getClientRects: () => [{ left: 20, top: 50, width: 100, height: 20 }] }),
  } as unknown as Selection
  const frame = {
    getBoundingClientRect: () => ({ left: 200, top: 100 }),
    clientLeft: 1,
    clientTop: 2,
  } as HTMLIFrameElement
  expect(selectionAnchor(selection, frame)).toEqual({ left: 271, top: 152 })
  expect(selectionAnchor(null)).toBeNull()
})
it('keeps the toolbar inside narrow and edge viewports', () => {
  expect(toolbarPosition({ left: 0, top: 0 }, 280, 48, 320, 600)).toEqual({ left: 8, top: 8 })
  expect(toolbarPosition({ left: 900, top: 1000 }, 280, 48, 320, 600)).toEqual({
    left: 32,
    top: 544,
  })
})
it('preserves native selection on pointer down and delegates color/note actions', async () => {
  const wrapper = mount(HighlightSelectionToolbar, {
    props: { format: 'EPUB', anchor: { left: 150, top: 200 }, disabled: false },
  })
  const event = new Event('pointerdown', { cancelable: true, bubbles: true })
  wrapper.element.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await wrapper.get('[aria-label="Highlight blue"]').trigger('click')
  await wrapper.findAll('button').at(-1)!.trigger('click')
  expect(wrapper.emitted('highlight')).toEqual([['blue']])
  expect(wrapper.emitted('note')).toEqual([[]])
  await wrapper.setProps({ disabled: true })
  expect(
    wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
  ).toBe(true)
  wrapper.unmount()
})

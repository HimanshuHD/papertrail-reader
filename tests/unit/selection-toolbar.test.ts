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
  expect(wrapper.emitted('color')).toEqual([['blue']])
  expect(wrapper.emitted('highlight')).toBeUndefined()
  expect(wrapper.find('textarea').exists()).toBe(true)
  expect(wrapper.emitted('saveNote')).toBeUndefined()
  await wrapper.setProps({ disabled: true })
  expect(
    wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
  ).toBe(true)
  wrapper.unmount()
})

it('expands without writing, submits both fields, and cancels only the note draft', async () => {
  const wrapper = mount(HighlightSelectionToolbar, {
    props: { format: 'PDF', anchor: { left: 150, top: 300 }, disabled: false },
  })
  await wrapper.get('[aria-label="Add note"]').trigger('click')
  expect(wrapper.emitted('highlight')).toBeUndefined()
  await wrapper.get('textarea').setValue('Combined note')
  await wrapper.get('[aria-label="Highlight pink"]').trigger('click')
  expect(wrapper.emitted('highlight')).toBeUndefined()
  expect(wrapper.text()).toContain('Save highlight with note')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('saveNote')).toEqual([['Combined note', 'pink']])
  await wrapper.get('[aria-label="Back to highlight controls"]').trigger('click')
  expect(wrapper.find('textarea').exists()).toBe(false)
  await wrapper.get('[aria-label="Add note"]').trigger('click')
  expect(wrapper.get('textarea').element).toHaveProperty('value', '')
  await wrapper.get('[aria-label="Add highlight"]').trigger('click')
  expect(wrapper.emitted('highlight')).toEqual([['pink', true]])
  await wrapper.setProps({ saved: true })
  expect(wrapper.text()).toContain('Save note')
  expect(wrapper.get('[aria-label="Add highlight"]').attributes('disabled')).toBeDefined()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Cancel')!
    .trigger('click')
  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(wrapper.props('saved')).toBe(true)
  wrapper.unmount()
})

it('allows textarea focus without clearing the document selection and preserves failed drafts', async () => {
  const wrapper = mount(HighlightSelectionToolbar, {
    props: { format: 'EPUB', anchor: { left: 150, top: 300 }, disabled: false },
  })
  await wrapper.get('[aria-label="Add note"]').trigger('click')
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  wrapper.get('textarea').element.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  await wrapper.get('textarea').setValue('Keep this draft')
  await wrapper.setProps({ disabled: true, notice: 'The change could not be saved.' })
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Keep this draft')
  expect(wrapper.text()).toContain('could not be saved')
  wrapper.unmount()
})

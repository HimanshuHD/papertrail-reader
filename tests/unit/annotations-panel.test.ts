import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import AnnotationsPanel from '../../src/components/viewer/AnnotationsPanel.vue'
import type { Annotation } from '../../src/services/annotation-storage'

const records: Annotation[] = [
  {
    version: 2,
    id: 'first',
    color: 'yellow',
    note: '<img src=x onerror=alert(1)>\nPlain text note',
    createdAt: 1,
    updatedAt: 1,
    selector: {
      version: 1,
      format: 'EPUB',
      chapter: 0,
      mode: 'formatted',
      cfi: null,
      text: { start: 0, end: 5, exact: 'Hello', prefix: '', suffix: '' },
    },
  },
  {
    version: 2,
    id: 'second',
    color: 'blue',
    note: '',
    createdAt: 2,
    updatedAt: 2,
    selector: {
      version: 1,
      format: 'PDF',
      segments: [
        {
          page: 3,
          text: { start: 0, end: 5, exact: 'World', prefix: '', suffix: '' },
          rectangles: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
        },
      ],
    },
  },
]
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function panel() {
  const saveNote = vi.fn(async () => true)
  const recolor = vi.fn(async () => true)
  const remove = vi.fn(async () => true)
  const wrapper = mount(AnnotationsPanel, {
    attachTo: document.body,
    props: {
      format: 'EPUB',
      annotations: structuredClone(records),
      selectedId: 'first',
      unresolved: { first: true },
      available: true,
      busy: false,
      loading: false,
      notice: '',
      saveNote,
      recolor,
      remove,
    },
  })
  wrappers.push(wrapper)
  return { wrapper, saveNote, recolor, remove }
}
it('renders notes safely, labels unresolved anchors and delegates navigation and color changes', async () => {
  const { wrapper, recolor } = panel()
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('Unresolved')
  await wrapper.get('[data-annotation-id="first"]').trigger('click')
  expect(wrapper.emitted('navigate')).toEqual([['first']])
  await wrapper.get('#epub-annotations-edit-color').setValue('green')
  expect(recolor).toHaveBeenCalledWith('first', 'green')
})
it('combines note/quote/location search with color and notes-only filters', async () => {
  const { wrapper } = panel()
  await wrapper.get('#epub-annotations-filter').setValue('plain text')
  expect(wrapper.findAll('[data-annotation-id]')).toHaveLength(1)
  await wrapper.get('#epub-annotations-color-filter').setValue('blue')
  expect(wrapper.text()).toContain('No annotations match these filters.')
  await wrapper.get('#epub-annotations-filter').setValue('page 3')
  expect(wrapper.findAll('[data-annotation-id]')).toHaveLength(1)
  await wrapper.get('input[type="checkbox"]').setValue(true)
  expect(wrapper.findAll('[data-annotation-id]')).toHaveLength(0)
})
it('retains failed drafts, enforces the note bound and restores list focus on cancel', async () => {
  const { wrapper, saveNote } = panel()
  saveNote.mockResolvedValue(false)
  await wrapper.get('textarea').setValue('Unsaved local draft')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(saveNote).toHaveBeenCalledWith('first', 'Unsaved local draft')
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Unsaved local draft')
  await wrapper.get('textarea').setValue('x'.repeat(4001))
  await wrapper.get('form').trigger('submit')
  expect(saveNote).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Note is too long.')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Cancel edit')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.get('textarea').element).toHaveProperty('value', records[0]!.note)
  expect(document.activeElement?.getAttribute('data-annotation-id')).toBe('first')
})
it('clears only the note or explicitly deletes its highlight, and locks failed storage until retry', async () => {
  const { wrapper, saveNote, remove } = panel()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Delete note')!
    .trigger('click')
  await flushPromises()
  expect(saveNote).toHaveBeenCalledWith('first', '')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Delete highlight and note')!
    .trigger('click')
  await flushPromises()
  expect(remove).toHaveBeenCalledWith('first')
  await wrapper.setProps({ available: false, notice: 'Storage is unavailable.' })
  expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Retry annotations')!
    .trigger('click')
  expect(wrapper.emitted('retry')).toEqual([[]])
})
it('does not replace a new selection draft after an earlier save completes', async () => {
  const { wrapper, saveNote } = panel()
  let finish!: (value: boolean) => void
  saveNote.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  await wrapper.get('textarea').setValue('First selection draft')
  await wrapper.get('form').trigger('submit')
  await wrapper.setProps({ selectedId: 'second' })
  await wrapper.get('textarea').setValue('Second selection draft')
  finish(true)
  await flushPromises()
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Second selection draft')
})
it('preserves a dirty draft on color refresh and shows a useful empty state', async () => {
  const { wrapper } = panel()
  await wrapper.get('textarea').setValue('Unsaved note')
  await wrapper.setProps({ annotations: [{ ...records[0]!, color: 'green' }, records[1]!] })
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Unsaved note')
  await wrapper.setProps({ annotations: [], selectedId: '' })
  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(wrapper.text()).toContain('save a highlight to add your first note')
})

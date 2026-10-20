import { config } from '@vue/test-utils'
config.global.stubs.teleport = true
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import AnnotationsPanel from '../../src/components/viewer/AnnotationsPanel.vue'
import { downloadJson } from '../../src/services/file-download'
vi.mock('../../src/services/file-download', () => ({ downloadJson: vi.fn() }))
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
async function panel() {
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
  wrapper.vm.editNote('first')
  await flushPromises()
  wrappers.push(wrapper)
  return { wrapper, saveNote, recolor, remove }
}
it('renders notes safely, labels unresolved anchors and delegates navigation and color changes', async () => {
  const { wrapper, recolor } = await panel()
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('Unresolved')
  await wrapper.get('[data-annotation-id="first"]').trigger('click')
  expect(wrapper.emitted('navigate')).toEqual([['first']])
  await wrapper.get('[data-menu-id="first"]').trigger('click')
  await wrapper.get('#epub-annotations-color-first').setValue('green')
  expect(recolor).toHaveBeenCalledWith('first', 'green')
})
it('combines note/quote/location search with color and notes-only filters', async () => {
  const { wrapper } = await panel()
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
  const { wrapper, saveNote } = await panel()
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
    .find((button) => button.text() === 'Cancel')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(document.activeElement?.getAttribute('data-menu-id')).toBe('first')
})
it('clears only the note or explicitly deletes its highlight, and locks failed storage until retry', async () => {
  const { wrapper, saveNote, remove } = await panel()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Delete note')!
    .trigger('click')
  await flushPromises()
  expect(saveNote).toHaveBeenCalledWith('first', '')
  await wrapper.get('[aria-label="Back to annotation actions"]').trigger('click')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Delete highlight and note')!
    .trigger('click')
  await flushPromises()
  expect(remove).toHaveBeenCalledWith('first')
  wrapper.vm.editNote('first')
  await flushPromises()
  await wrapper.setProps({ available: false, notice: 'Storage is unavailable.' })
  expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Retry annotations')!
    .trigger('click')
  expect(wrapper.emitted('retry')).toEqual([[]])
})
it('does not replace a new selection draft after an earlier save completes', async () => {
  const { wrapper, saveNote } = await panel()
  let finish!: (value: boolean) => void
  saveNote.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  await wrapper.get('textarea').setValue('First selection draft')
  await wrapper.get('form').trigger('submit')
  await wrapper.setProps({ selectedId: 'second' })
  wrapper.vm.editNote('second')
  await flushPromises()
  await wrapper.get('textarea').setValue('Second selection draft')
  finish(true)
  await flushPromises()
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Second selection draft')
})
it('preserves a dirty draft on color refresh and shows a useful empty state', async () => {
  const { wrapper } = await panel()
  await wrapper.get('textarea').setValue('Unsaved note')
  await wrapper.setProps({ annotations: [{ ...records[0]!, color: 'green' }, records[1]!] })
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Unsaved note')
  await wrapper.setProps({ annotations: [], selectedId: '' })
  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(wrapper.text()).toContain('save a highlight to add your first note')
})

it('truncates only the displayed quote and keeps full text searchable', async () => {
  const { wrapper } = await panel()
  const exact = 'a'.repeat(100) + ' a hidden ending'
  const record = structuredClone(records[0]!)
  if (record.selector.format === 'EPUB') record.selector.text.exact = exact
  await wrapper.setProps({ annotations: [record] })
  expect(wrapper.get('.annotation-quote').text()).toBe('“' + 'a'.repeat(100) + '...”')
  await wrapper.get('#epub-annotations-filter').setValue('hidden ending')
  expect(wrapper.findAll('[data-annotation-id]')).toHaveLength(1)
})
it('opens the note editor without changing list scroll and dismisses actions outside', async () => {
  const { wrapper } = await panel()
  wrapper.element.scrollTop = 80
  await wrapper.get('textarea').setValue('Draft')
  expect(wrapper.element.scrollTop).toBe(80)
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await flushPromises()
  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(wrapper.get('[data-menu-id="first"]').attributes('aria-expanded')).toBe('false')
})

it('selects the editor entry without requesting reader navigation', async () => {
  const { wrapper } = await panel()
  wrapper.vm.editNote('second')
  await flushPromises()
  expect(wrapper.emitted('select')).toEqual([['second']])
  expect(wrapper.emitted('navigate')).toBeUndefined()
})

it('exports every committed annotation despite filters and excludes an unsaved draft', async () => {
  const { wrapper, saveNote, recolor, remove } = await panel()
  const second = { ...structuredClone(records[0]!), id: 'other', note: 'Other saved note' }
  await wrapper.setProps({
    identity: { format: 'EPUB', fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) },
    documentName: 'book.epub',
    annotations: [records[0]!, second],
  })
  await wrapper.get('textarea').setValue('Unsaved draft')
  // Keep the editor open and prove export does not close it or commit the draft.
  const button = wrapper.get('[aria-label="Export annotations (JSON)"]')
  await button.trigger('click')
  const [json, filename] = vi.mocked(downloadJson).mock.calls.at(-1)!
  expect(filename).toBe('papertrail-book-annotations.json')
  expect(JSON.parse(json).annotations.map((item: Annotation) => item.note)).toEqual([
    records[0]!.note,
    'Other saved note',
  ])
  expect(wrapper.get('textarea').element).toHaveProperty('value', 'Unsaved draft')
  expect(saveNote).not.toHaveBeenCalled()
  expect(recolor).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
  await wrapper.get('#epub-annotations-filter').setValue('nothing matches')
  await button.trigger('click')
  expect(JSON.parse(vi.mocked(downloadJson).mock.calls.at(-1)![0]).annotations).toHaveLength(2)
  expect(wrapper.text()).toContain('Download requested.')
})
it('disables unavailable/busy exports and reports a recoverable download failure', async () => {
  const { wrapper } = await panel()
  const button = wrapper.get('[aria-label="Export annotations (JSON)"]')
  expect(button.attributes('disabled')).toBeDefined()
  await wrapper.setProps({
    identity: { format: 'EPUB', fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) },
    documentName: 'book.epub',
    annotations: [records[0]!],
  })
  for (const props of [{ busy: true }, { loading: true }, { available: false }]) {
    await wrapper.setProps({ busy: false, loading: false, available: true, ...props })
    expect(button.attributes('disabled')).toBeDefined()
  }
  await wrapper.setProps({ busy: false, loading: false, available: true })
  vi.mocked(downloadJson).mockImplementationOnce(() => {
    throw Error('blocked')
  })
  await button.trigger('click')
  expect(wrapper.text()).toContain('Close and reopen annotations, then try again.')
  expect(button.attributes('aria-describedby')).toBe('epub-annotations-export-help')
})

it('disables export for an empty saved collection and after its last annotation is removed', async () => {
  const { wrapper } = await panel()
  await wrapper.setProps({
    identity: { format: 'EPUB', fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) },
    documentName: 'book.epub',
    annotations: [],
    selectedId: '',
  })
  const button = wrapper.get('[aria-label="Export annotations (JSON)"]')
  const calls = vi.mocked(downloadJson).mock.calls.length
  expect(button.attributes('disabled')).toBeDefined()
  await button.trigger('click')
  expect(downloadJson).toHaveBeenCalledTimes(calls)
  await wrapper.setProps({ annotations: [records[0]!] })
  expect(button.attributes('disabled')).toBeUndefined()
  await wrapper.get('#epub-annotations-filter').setValue('no matching annotations')
  expect(wrapper.findAll('[data-annotation-id]')).toHaveLength(0)
  expect(button.attributes('disabled')).toBeUndefined()
  await wrapper.setProps({ annotations: [] })
  expect(button.attributes('disabled')).toBeDefined()
  await button.trigger('click')
  expect(downloadJson).toHaveBeenCalledTimes(calls)
})

import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import EpubReaderWorkspace from '../../src/components/viewer/EpubReaderWorkspace.vue'
import type { EpubSession } from '../../src/features/epub/epub-session'

const mocked = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../src/features/epub/epub-session', () => ({ openEpubSession: mocked.open }))

it('opens formatted by default, keeps side navigation outside the header and retains position across modes', async () => {
  const position = { node: 'pt-3', offset: -10, ratio: 0.4 }
  const sessions: EpubSession[] = Array.from({ length: 3 }, () => ({
    title: 'Book',
    contents: [],
    contentsSource: 'spine',
    typography: vi.fn(),
    chapters: [
      { label: 'One', href: 'one' },
      { label: 'Two', href: 'two' },
    ],
    display: vi.fn(async () => {}),
    position: () => position,
    appearance: vi.fn(),
    destroy: vi.fn(),
  }))
  for (const session of sessions) mocked.open.mockResolvedValueOnce(session)
  const book = (name: string) => ({
    id: name,
    name,
    format: 'EPUB' as const,
    relativePath: name,
    parentPath: '',
    source: 'file-input' as const,
    file: new File([], name),
  })
  const wrapper = mount(EpubReaderWorkspace, {
    props: { document: book('one.epub') },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  const checkbox = wrapper.get('input[type="checkbox"]')
  expect(checkbox.element).toHaveProperty('checked', false)
  expect(mocked.open.mock.calls[0]![3]).toMatchObject({ textOnly: false, chapter: 0 })
  expect(wrapper.find('select').exists()).toBe(false)
  expect(wrapper.get('button[aria-label="Contents"]').attributes('aria-expanded')).toBe('false')
  expect(wrapper.find('header button[aria-label="Next chapter"]').exists()).toBe(false)
  expect(
    wrapper.get('.epub-stage button[aria-label="Previous chapter"]').attributes('disabled'),
  ).toBeDefined()
  await wrapper.get('.epub-stage button[aria-label="Next chapter"]').trigger('click')
  await flushPromises()
  expect(sessions[0]!.display).toHaveBeenCalledWith(1)
  await checkbox.setValue(true)
  await flushPromises()
  expect(mocked.open.mock.calls[1]![3]).toEqual({
    textOnly: true,
    chapter: 1,
    position,
    typography: { fontSize: null, lineSpacing: null, readingWidth: null },
  })
  expect(sessions[0]!.destroy).toHaveBeenCalledOnce()
  expect(wrapper.get('header').text()).toContain('Chapter 2 of 2')
  await wrapper.setProps({ document: book('other.epub') })
  await flushPromises()
  expect(checkbox.element).toHaveProperty('checked', false)
  expect(mocked.open.mock.calls[2]![3]).toMatchObject({ textOnly: false, chapter: 0 })
  wrapper.unmount()
  expect(sessions[2]!.destroy).toHaveBeenCalledOnce()
})

it('exposes nested contents/current location and keeps typography across modes but resets a new source', async () => {
  const contents = [
    {
      id: 'group',
      label: 'Part One',
      chapter: null,
      children: [
        { id: 'section', label: 'Later section', chapter: 0, fragment: 'anchor', children: [] },
      ],
    },
  ]
  const sessions: EpubSession[] = Array.from({ length: 3 }, () => ({
    title: 'Book',
    chapters: [{ label: 'One', href: 'one' }],
    contents,
    contentsSource: 'nav',
    typography: vi.fn(),
    display: vi.fn(async () => {}),
    appearance: vi.fn(),
    destroy: vi.fn(),
  }))
  for (const session of sessions) mocked.open.mockResolvedValueOnce(session)
  const book = (name: string) => ({
    id: name,
    name,
    format: 'EPUB' as const,
    relativePath: name,
    parentPath: '',
    source: 'file-input' as const,
    file: new File([], name),
  })
  const wrapper = mount(EpubReaderWorkspace, {
    props: { document: book('book.epub') },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  await wrapper.get('button[aria-label="Contents"]').trigger('click')
  const section = wrapper.findAll('nav button').find((button) => button.text() === 'Later section')!
  await section.trigger('click')
  await flushPromises()
  expect(sessions[0]!.display).toHaveBeenCalledWith(0, 'anchor')
  expect(section.attributes('aria-current')).toBe('location')
  await wrapper.get('button[aria-label="Typography"]').trigger('click')
  await wrapper.get('button[aria-label="Increase font size"]').trigger('click')
  await wrapper.get('button[aria-label="Increase font size"]').trigger('click')
  await wrapper
    .findAll('[role="group"][aria-label="Line spacing"] button')
    .find((button) => button.text() === 'Comfortable')!
    .trigger('click')
  await wrapper
    .findAll('[role="group"][aria-label="Reading width"] button')
    .find((button) => button.text() === 'Medium')!
    .trigger('click')
  expect(sessions[0]!.typography).toHaveBeenLastCalledWith({
    fontSize: 22,
    lineSpacing: 1.8,
    readingWidth: 640,
  })
  await wrapper.get('input[type="checkbox"]').setValue(true)
  await flushPromises()
  expect(mocked.open.mock.calls[1]![3]).toMatchObject({
    typography: { fontSize: 22, lineSpacing: 1.8, readingWidth: 640 },
  })
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Reset typography')!
    .trigger('click')
  expect(sessions[1]!.typography).toHaveBeenLastCalledWith({
    fontSize: null,
    lineSpacing: null,
    readingWidth: null,
  })
  await wrapper.get('button[aria-label="Increase font size"]').trigger('click')
  await wrapper.setProps({ document: book('other.epub') })
  await flushPromises()
  expect(mocked.open.mock.calls[2]![3]).toMatchObject({
    typography: { fontSize: null, lineSpacing: null, readingWidth: null },
  })
  wrapper.unmount()
})

it('dismisses utility surfaces with Escape and outside pointers, restores focus and preserves the session', async () => {
  const session: EpubSession = {
    title: 'Book',
    chapters: [{ label: 'One', href: 'one' }],
    contents: [{ id: 'one', label: 'One', chapter: 0, children: [] }],
    contentsSource: 'spine',
    typography: vi.fn(),
    display: vi.fn(async () => {}),
    appearance: vi.fn(),
    destroy: vi.fn(),
  }
  mocked.open.mockResolvedValueOnce(session)
  const wrapper = mount(EpubReaderWorkspace, {
    attachTo: document.body,
    props: {
      document: {
        id: 'focus',
        name: 'focus.epub',
        format: 'EPUB',
        relativePath: 'focus.epub',
        parentPath: '',
        source: 'file-input',
        file: new File([], 'focus.epub'),
      },
    },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  await wrapper.get('button[aria-label="Contents"]').trigger('click')
  await flushPromises()
  expect(document.activeElement).toBe(
    wrapper.get('button[aria-label="Close utility panel"]').element,
  )
  await wrapper
    .get('button[aria-label="Close utility panel"]')
    .trigger('keydown', { key: 'Escape' })
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Contents"]').element)
  expect(wrapper.find('aside').exists()).toBe(false)
  await wrapper.get('button[aria-label="Typography"]').trigger('click')
  await flushPromises()
  await wrapper.get('button[aria-label="Close typography"]').trigger('keydown', { key: 'Escape' })
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Typography"]').element)
  await wrapper.get('button[aria-label="Typography"]').trigger('click')
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await flushPromises()
  expect(wrapper.find('#epub-typography').exists()).toBe(false)
  expect(mocked.open).toHaveBeenCalledTimes(1)
  expect(session.destroy).not.toHaveBeenCalled()
  wrapper.unmount()
})

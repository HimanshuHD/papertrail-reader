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
  const checkbox = wrapper.get('button[role="switch"]')
  expect(checkbox.attributes('aria-checked')).toBe('false')
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
  await checkbox.trigger('click')
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
  expect(checkbox.attributes('aria-checked')).toBe('false')
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
  await wrapper.get('button[role="switch"]').trigger('click')
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

it('keeps Contents stable while loading and delays the overlay loader without changing the stage layout', async () => {
  let finish!: () => void
  const session: EpubSession = {
    title: 'Stable book',
    chapters: [
      { label: 'One', href: 'one' },
      { label: 'Two', href: 'two' },
    ],
    contents: [
      { id: 'one', label: 'One', chapter: 0, children: [] },
      { id: 'two', label: 'Two', chapter: 1, children: [] },
    ],
    contentsSource: 'spine',
    typography: vi.fn(),
    defaultFontSize: () => 16,
    display: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    ),
    appearance: vi.fn(),
    destroy: vi.fn(),
  }
  mocked.open.mockResolvedValueOnce(session)
  const wrapper = mount(EpubReaderWorkspace, {
    props: {
      document: {
        id: 'load',
        name: 'load.epub',
        format: 'EPUB',
        relativePath: 'load.epub',
        parentPath: '',
        source: 'file-input',
        file: new File([], 'load.epub'),
      },
    },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await wrapper.get('button[aria-label="Contents"]').trigger('click')
    await wrapper
      .findAll('nav button')
      .find((button) => button.text() === 'Two')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.findAll('nav button').map((button) => button.text())).toEqual(['One', 'Two'])
    expect(wrapper.find('.epub-loading-cover').exists()).toBe(true)
    expect(wrapper.find('.loading-card').exists()).toBe(false)
    expect(wrapper.find('header + p[role="status"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(150)
    expect(wrapper.get('.loading-card').text()).toContain('Loading chapter')
    finish()
    await flushPromises()
    expect(wrapper.find('.epub-loading-cover').exists()).toBe(false)
    await wrapper.get('button[aria-label="Typography"]').trigger('click')
    expect(wrapper.get('output').text()).toBe('Book default (16 px)')
    await wrapper.get('button[aria-label="Increase font size"]').trigger('click')
    expect(session.typography).toHaveBeenLastCalledWith({
      fontSize: 18,
      lineSpacing: null,
      readingWidth: null,
    })
    await wrapper.get('button[aria-label="Decrease font size"]').trigger('click')
    expect(wrapper.get('output').text()).toBe('Book default (16 px)')
    let opened!: (session: EpubSession) => void
    mocked.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          opened = resolve
        }),
    )
    await wrapper.get('[role="switch"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('nav button').map((button) => button.text())).toEqual(['One', 'Two'])
    expect(wrapper.get('#reader-title').text()).toBe('Stable book')
    opened({ ...session, destroy: vi.fn() })
    await flushPromises()
  } finally {
    wrapper.unmount()
    vi.useRealTimers()
  }
})

it('dismisses Typography from inside its iframe and limits width controls as the window changes', async () => {
  const session: EpubSession = {
    title: 'Book',
    chapters: [{ label: 'One', href: 'one' }],
    contents: [],
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
        id: 'frame',
        name: 'frame.epub',
        format: 'EPUB',
        relativePath: 'frame.epub',
        parentPath: '',
        source: 'file-input',
        file: new File([], 'frame.epub'),
      },
    },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  try {
    await wrapper.get('button[aria-label="Typography"]').trigger('click')
    const frame = document.createElement('iframe')
    wrapper.get('.epub-host').element.append(frame)
    frame.dispatchEvent(new Event('load'))
    frame.contentDocument!.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('#epub-typography').exists()).toBe(false)
    await wrapper.get('button[aria-label="Typography"]').trigger('click')
    vi.stubGlobal('innerWidth', 1280)
    globalThis.dispatchEvent(new Event('resize'))
    await flushPromises()
    await wrapper
      .findAll('[aria-label="Reading width"] button')
      .find((button) => button.text() === 'Wide')!
      .trigger('click')
    vi.stubGlobal('innerWidth', 800)
    globalThis.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(
      wrapper.findAll('[aria-label="Reading width"] button').map((button) => button.text()),
    ).toEqual(['Full width', 'Narrow', 'Medium'])
    expect(session.typography).toHaveBeenLastCalledWith({
      fontSize: null,
      lineSpacing: null,
      readingWidth: 640,
    })
    vi.stubGlobal('innerWidth', 390)
    globalThis.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(wrapper.find('[aria-label="Reading width"]').exists()).toBe(false)
    expect(session.typography).toHaveBeenLastCalledWith({
      fontSize: null,
      lineSpacing: null,
      readingWidth: null,
    })
  } finally {
    wrapper.unmount()
    vi.unstubAllGlobals()
  }
})

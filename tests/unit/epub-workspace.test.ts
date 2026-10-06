import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import EpubReaderWorkspace from '../../src/components/viewer/EpubReaderWorkspace.vue'
import type { EpubBookmark } from '../../src/services/epub-reading-storage'
import type {
  Annotation,
  AnnotationHandle,
  AnnotationColor,
} from '../../src/services/annotation-storage'
import type {
  AnnotationIdentity,
  AnnotationSelector,
} from '../../src/features/annotations/selectors'
import type { EpubSession } from '../../src/features/epub/epub-session'

const mocked = vi.hoisted(() => ({
  open: vi.fn(),
  highlightOpen: vi.fn(),
  highlightCreate: vi.fn(),
  highlightUpdate: vi.fn(),
  resolve: vi.fn(),
  save: vi.fn(async () => undefined),
  load: vi.fn(async () => [] as EpubBookmark[]),
  add: vi.fn(async () => []),
  rename: vi.fn(async () => []),
  remove: vi.fn(async () => []),
}))
vi.mock('../../src/features/epub/epub-session', () => ({ openEpubSession: mocked.open }))

vi.mock('../../src/services/annotation-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/annotation-storage')>()
  return {
    ...actual,
    IndexedDbAnnotationStorage: class {
      records: Annotation[] = []
      async open(identity: AnnotationIdentity) {
        mocked.highlightOpen(identity)
        return { handle: { identity, generation: 'g' }, annotations: this.records }
      }
      async list() {
        return [...this.records]
      }
      async create(handle: AnnotationHandle, selector: AnnotationSelector, color: AnnotationColor) {
        mocked.highlightCreate(handle, selector, color)
        const entry: Annotation = {
          version: 2,
          id: 'highlight-one',
          selector,
          color,
          note: '',
          createdAt: 1,
          updatedAt: 1,
        }
        this.records.push(entry)
        return entry
      }
      async update(
        _handle: AnnotationHandle,
        id: string,
        patch: { color?: AnnotationColor; note?: string },
      ) {
        const entry = this.records.find((item) => item.id === id)!
        mocked.highlightUpdate(id, patch)
        if (patch.color !== undefined) entry.color = patch.color
        if (patch.note !== undefined) entry.note = patch.note
        return entry
      }
      async remove(_handle: AnnotationHandle, id: string) {
        this.records = this.records.filter((item) => item.id !== id)
      }
    },
  }
})
vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async () => 'sha256-chunks-v1:' + 'a'.repeat(64)),
}))

vi.mock('../../src/services/epub-reading-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/epub-reading-storage')>()
  return {
    ...actual,
    IndexedDbEpubReadingStorage: class {
      resolve(fingerprint: string, name: string) {
        return (
          mocked.resolve(fingerprint, name) ??
          Promise.resolve({
            record: {
              version: 1,
              format: 'EPUB',
              id: `epub:${name}`,
              fingerprint,
              name,
              updatedAt: 1,
              bookmarks: [],
              textOnly: false,
              typography: { fontSize: null, lineSpacing: null, readingWidth: null },
            },
            ambiguous: false,
          })
        )
      }
      save = mocked.save
      load = mocked.load
      add = mocked.add
      rename = mocked.rename
      remove = mocked.remove
    },
  }
})

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
  expect(wrapper.find('header select').exists()).toBe(false)
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

it('restores saved mode, typography and chapter before opening, and flushes progress before replacement', async () => {
  const location = {
    version: 1 as const,
    chapter: 1,
    mode: 'formatted' as const,
    kind: 'text' as const,
    cfi: null,
    node: 'pt-4',
    character: 8,
    quote: 'saved',
    offset: -3,
    ratio: 0.4,
    atEnd: false,
  }
  const mark = { id: 'bookmark', name: 'Saved section', location, createdAt: 1 }
  const session: EpubSession = {
    title: 'Saved book',
    chapters: [
      { label: 'One', href: 'one' },
      { label: 'Two', href: 'two' },
    ],
    contents: [],
    contentsSource: 'spine',
    display: vi.fn(async () => undefined),
    typography: vi.fn(),
    appearance: vi.fn(),
    destroy: vi.fn(),
    location: () => location,
    restore: vi.fn(async () => true),
  }
  const file = (name: string) => ({
    id: name,
    name,
    format: 'EPUB' as const,
    relativePath: name,
    parentPath: '',
    source: 'file-input' as const,
    file: new File([], name),
  })
  mocked.resolve.mockResolvedValueOnce({
    record: {
      id: 'epub:saved',
      textOnly: true,
      typography: { fontSize: 22, lineSpacing: 1.8, readingWidth: null },
      location,
    },
    ambiguous: false,
  })
  mocked.load.mockResolvedValueOnce([mark])
  mocked.open.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, title: 'Other' })
  const wrapper = mount(EpubReaderWorkspace, {
    props: { document: file('saved.epub') },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  expect(mocked.open.mock.lastCall![3]).toMatchObject({
    textOnly: true,
    location,
    typography: { fontSize: 22 },
  })
  expect(wrapper.get('header').text()).toContain('Chapter 2 of 2')
  expect(wrapper.get('button[role="switch"]').attributes('aria-checked')).toBe('true')
  expect(wrapper.emitted('recentReady')?.[0]).toEqual([
    { id: 'epub:saved', fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) },
  ])
  await wrapper.get('button[aria-label="Bookmarks"]').trigger('click')
  await flushPromises()
  await wrapper.get('button[aria-label="Go to bookmark Saved section"]').trigger('click')
  await flushPromises()
  expect(session.restore).toHaveBeenCalledWith(location)
  await wrapper.setProps({ document: file('other.epub') })
  await flushPromises()
  expect(mocked.save).toHaveBeenCalledWith('epub:saved', {
    textOnly: true,
    typography: { fontSize: 22, lineSpacing: 1.8, readingWidth: null },
    location,
  })
  expect(wrapper.get('button[role="switch"]').attributes('aria-checked')).toBe('false')
  wrapper.unmount()
  await flushPromises()
  expect(mocked.save).toHaveBeenCalledWith(
    'epub:other.epub',
    expect.objectContaining({ location, textOnly: false }),
  )
})

it('captures iframe selections and saves, recolors and deletes fingerprint-scoped EPUB highlights', async () => {
  let frameDoc: Document
  const revealRange = vi.fn(() => true)
  mocked.open.mockImplementationOnce(async (_file, target: HTMLElement) => {
    const frame = document.createElement('iframe')
    target.append(frame)
    frameDoc = frame.contentDocument!
    frameDoc.body.innerHTML = '<p>Hello <em>world</em>.</p>'
    return {
      title: 'Highlights',
      chapters: [{ label: 'One', href: 'one' }],
      contents: [],
      contentsSource: 'spine',
      display: vi.fn(async () => undefined),
      typography: vi.fn(),
      appearance: vi.fn(),
      destroy: () => frame.remove(),
      annotationContext: () => ({ document: frameDoc, chapter: 0, mode: 'formatted' }),
      revealRange,
    }
  })
  const wrapper = mount(EpubReaderWorkspace, {
    attachTo: document.body,
    props: {
      document: {
        id: 'highlights',
        name: 'highlights.epub',
        format: 'EPUB',
        relativePath: 'highlights.epub',
        parentPath: '',
        source: 'file-input',
        file: new File([], 'highlights.epub'),
      },
    },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  const range = frameDoc!.createRange()
  range.selectNodeContents(frameDoc!.querySelector('p')!)
  frameDoc!.getSelection()!.addRange(range)
  frameDoc!.dispatchEvent(new Event('pointerup'))
  await wrapper.vm.$nextTick()
  const save = wrapper.findAll('button').find((button) => button.text() === 'Highlight selection')!
  expect(save.attributes('disabled')).toBeUndefined()
  await wrapper.get('#epub-highlight-color').setValue('pink')
  await save.trigger('click')
  await flushPromises()
  expect(mocked.highlightOpen).toHaveBeenLastCalledWith({
    format: 'EPUB',
    fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64),
  })
  expect(mocked.highlightCreate).toHaveBeenLastCalledWith(
    expect.objectContaining({ identity: expect.objectContaining({ format: 'EPUB' }) }),
    expect.objectContaining({
      format: 'EPUB',
      text: expect.objectContaining({ exact: 'Hello world.' }),
    }),
    'pink',
  )
  expect(wrapper.text()).toContain('Highlights (1)')
  await wrapper.get('#epub-highlight-color').setValue('green')
  await flushPromises()
  expect(mocked.highlightUpdate).toHaveBeenLastCalledWith('highlight-one', { color: 'green' })
  const edits = mocked.highlightUpdate.mock.calls.length
  frameDoc!.getSelection()!.addRange(range)
  frameDoc!.dispatchEvent(new Event('pointerup'))
  await wrapper.vm.$nextTick()
  await wrapper.get('#epub-highlight-color').setValue('blue')
  await flushPromises()
  expect(mocked.highlightUpdate).toHaveBeenCalledTimes(edits)
  await wrapper.get('#epub-saved-highlights').setValue('highlight-one')
  await flushPromises()
  expect(revealRange).toHaveBeenCalledOnce()
  expect((revealRange.mock.calls[0] as unknown as [Range])[0].toString()).toBe('Hello world.')
  await wrapper.get('button[aria-label="Annotations"]').trigger('click')
  await flushPromises()
  await wrapper.get('#epub-annotations-note').setValue('A local EPUB note')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(mocked.highlightUpdate).toHaveBeenLastCalledWith('highlight-one', {
    note: 'A local EPUB note',
  })
  expect(wrapper.text()).toContain('A local EPUB note')
  await wrapper.get('button[aria-label="Close utility panel"]').trigger('click')
  await flushPromises()
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Annotations')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Delete highlight')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Highlights (0)')
  wrapper.unmount()
})

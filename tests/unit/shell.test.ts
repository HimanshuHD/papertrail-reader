import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pdfSessionMocks = vi.hoisted(() => ({
  open: vi.fn(),
  render: vi.fn(),
  close: vi.fn(),
  getOutline: vi.fn(),
  searchText: vi.fn(),
}))

vi.mock('../../src/features/pdf/pdf-session', async (importOriginal) => {
  class PdfOpenError extends Error {}
  return {
    ...(await importOriginal<typeof import('../../src/features/pdf/pdf-session')>()),
    PdfOpenError,
    openPdfDocument: pdfSessionMocks.open,
  }
})
vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async () => 'shell-fixture'),
}))
import App from '../../src/App.vue'
import * as discovery from '../../src/features/library/discovery'
import ReaderView from '../../src/views/ReaderView.vue'
import { createAppRouter } from '../../src/router'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.clearAllMocks()
  pdfSessionMocks.render.mockResolvedValue({ scale: 1.25, width: 765, height: 990 })
  pdfSessionMocks.getOutline.mockResolvedValue([
    {
      title: 'Chapter one',
      pageNumber: 2,
      children: [],
    },
  ])
  pdfSessionMocks.searchText.mockResolvedValue({
    matches: [
      {
        pageNumber: 2,
        occurrence: 1,
        excerpt: 'PaperTrail searchable text',
      },
    ],
    textPageCount: 3,
    truncated: false,
  })
  pdfSessionMocks.open.mockImplementation(async () => ({
    totalPages: 3,
    getPageDimensions: vi.fn().mockResolvedValue({ width: 600, height: 800 }),
    render: pdfSessionMocks.render,
    close: pdfSessionMocks.close,
    getOutline: pdfSessionMocks.getOutline,
    searchText: pdfSessionMocks.searchText,
  }))
})

afterEach(() => vi.useRealTimers())
async function finishDiscovery() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(3000)
  await flushPromises()
}

async function mountApp(path = '/') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router] },
  })
  return { wrapper, router }
}

function inputFiles(input: Element, files: readonly File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  })
}

function folderFile(name: string, relativePath: string) {
  const file = new File([relativePath], name)
  Object.defineProperty(file, 'webkitRelativePath', {
    configurable: true,
    value: relativePath,
  })
  return file
}

describe('home and product shell', () => {
  it('retains home content and navigates from the card to the separate app and back', async () => {
    const { wrapper, router } = await mountApp()
    expect(wrapper.text()).toContain('The foundation is ready')
    const link = wrapper.get('section a[href="/app"]')
    expect(link.text()).toContain('Go to app')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reader')
    expect(wrapper.find('aside').exists()).toBe(true)
    await wrapper.get('a[aria-label="PaperTrail home"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    wrapper.unmount()
  })

  it('supports direct app entry and history navigation', async () => {
    const { wrapper, router } = await mountApp('/app')
    expect(wrapper.findComponent(ReaderView).exists()).toBe(true)
    await router.push('/')
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reader')
    wrapper.unmount()
  })

  it('keeps the production empty state while the sidebar collapses and restores', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.get('#reader-title').text()).toBe('Welcome to PaperTrail')
    expect(wrapper.text()).toContain('No documents selected yet')
    expect(wrapper.text()).not.toContain('The next chapter')
    expect(wrapper.text()).not.toContain('Demonstration workspace')

    const toggle = wrapper.get('button[aria-label="Hide library"]')
    await toggle.trigger('click')
    const opener = wrapper.get('button[aria-label="Show library"]')
    expect(opener.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.get('#reader-title').text()).toBe('Welcome to PaperTrail')

    await opener.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.get('#reader-title').text()).toBe('Welcome to PaperTrail')
    wrapper.unmount()
  })

  it('closes the library with Escape and restores focus to its toggle', async () => {
    const { wrapper } = await mountApp('/app')
    const addButton = wrapper.get('button[aria-label="Add local documents"]')
    ;(addButton.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(addButton.element)
    await addButton.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    const toggle = wrapper.get('button[aria-controls="document-sidebar"]')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(document.activeElement).toBe(toggle.element)
    expect(wrapper.get('p.sr-only[aria-live="polite"]').text()).toBe('Library hidden.')
    wrapper.unmount()
  })

  it('shows selected EPUB metadata without falling back to sample content', async () => {
    const { wrapper } = await mountApp('/app')
    const fileInput = wrapper.get('input[accept*=".pdf"]')
    const epubFile = new File(['epub'], 'book.epub', { type: 'application/epub+zip' })

    inputFiles(fileInput.element, [epubFile])
    await fileInput.trigger('change')
    await finishDiscovery()

    const localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
    const book = localLibrary
      .findAll('button')
      .find((button) => button.text().includes('book.epub'))!
    ;(book.element as HTMLButtonElement).focus()
    await book.trigger('click')

    expect(document.activeElement).toBe(book.element)
    expect(wrapper.get('#reader-title').text()).toBe('book.epub')
    expect(wrapper.text()).toContain(
      'Text reader · Book images and styling are omitted in this increment.',
    )
    expect(wrapper.text()).not.toContain('Demonstration workspace')
    expect(wrapper.get('p.sr-only[aria-live="polite"]').text()).toBe(
      'Opening local EPUB: book.epub.',
    )
    wrapper.unmount()
  })

  it('offers browser selection from the production empty state', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.text()).toContain('No documents selected yet')
    expect(wrapper.text()).toContain('Use the + button above to add a folder')
    expect(wrapper.text()).toContain('A quiet space for your next chapter')
    expect(wrapper.text()).toContain('Your documents will have room to breathe here.')
    expect(wrapper.text()).not.toContain('Getting started')
    expect(wrapper.text()).not.toContain('Demonstration workspace')
    expect(wrapper.text()).not.toContain('sample workspace')
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(2)

    await wrapper.get('button[aria-label="Add local documents"]').trigger('click')
    const folderButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Choose folder')
    expect(folderButton).toBeTruthy()
    expect(folderButton!.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Refresh library"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('uses the directory input fallback when the native directory picker is unavailable', async () => {
    const { wrapper } = await mountApp('/app')
    const directoryInput = wrapper.get('input[webkitdirectory]')
    const click = vi.spyOn(directoryInput.element as HTMLInputElement, 'click')
    await wrapper.get('button[aria-label="Add local documents"]').trigger('click')
    const folderButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Choose folder')!

    await folderButton.trigger('click')

    expect(click).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('renders individual file selections flat, selects them locally and offers reselection', async () => {
    const { wrapper } = await mountApp('/app')
    const fileInput = wrapper.get('input[accept*=".pdf"]')
    const click = vi.spyOn(fileInput.element as HTMLInputElement, 'click')
    const files = [
      new File(['pdf'], 'guide.pdf', { type: 'application/pdf' }),
      new File(['epub'], 'book.epub', { type: 'application/epub+zip' }),
    ]

    inputFiles(fileInput.element, files)
    await fileInput.trigger('change')
    await finishDiscovery()

    expect(wrapper.text()).toContain('2 items selected from the file picker')
    expect(wrapper.text()).toContain('2 supported documents found.')

    const localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
    expect(localLibrary.text()).toContain('Selected files')
    expect(localLibrary.text()).toContain('guide.pdf')
    expect(localLibrary.text()).toContain('book.epub')
    expect(localLibrary.findAll('button[aria-expanded]')).toHaveLength(0)

    const guide = localLibrary
      .findAll('button')
      .find((button) => button.text().includes('guide.pdf'))!
    await guide.trigger('click')
    await flushPromises()

    expect(guide.attributes('aria-pressed')).toBe('true')
    expect(pdfSessionMocks.open.mock.calls[0]?.[0]).toBe(files[0])
    expect(wrapper.get('#reader-title').text()).toBe('guide.pdf')
    expect(wrapper.text()).toContain('Page 1 of 3')
    expect(wrapper.find('button[aria-label="Next page"]').exists()).toBe(true)

    const next = wrapper.get('button[aria-label="Next page"]')
    await next.trigger('click')
    await flushPromises()
    expect(pdfSessionMocks.render).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 2,
        textLayer: expect.any(HTMLElement),
      }),
    )
    expect(wrapper.text()).toContain('Page 2 of 3')

    const book = localLibrary
      .findAll('button')
      .find((button) => button.text().includes('book.epub'))!
    await book.trigger('click')
    await flushPromises()
    expect(pdfSessionMocks.open).toHaveBeenCalledTimes(1)
    expect(pdfSessionMocks.close).toHaveBeenCalled()
    expect(wrapper.get('#reader-title').text()).toBe('book.epub')
    expect(wrapper.text()).toContain(
      'Text reader · Book images and styling are omitted in this increment.',
    )

    const reselect = wrapper.findAll('button').find((button) => button.text() === 'Reselect files')!
    await reselect.trigger('click')
    expect(click).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('supports PDF contents, search and keyboard help without hijacking text inputs', async () => {
    const { wrapper } = await mountApp('/app')
    const fileInput = wrapper.get('input[accept*=".pdf"]')
    const file = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' })

    inputFiles(fileInput.element, [file])
    await fileInput.trigger('change')
    await finishDiscovery()

    const localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
    const guide = localLibrary
      .findAll('button')
      .find((button) => button.text().includes('guide.pdf'))!
    await guide.trigger('click')
    await flushPromises()

    const contents = wrapper.get('button[aria-label="Contents"]')
    await contents.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Chapter one')

    await wrapper.trigger('keydown', { key: '/' })
    await flushPromises()
    const searchInput = wrapper.get('input[aria-label="Search PDF text"]')
    expect(document.activeElement).toBe(searchInput.element)
    await searchInput.setValue('PaperTrail')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(pdfSessionMocks.searchText).toHaveBeenCalledWith(
      'PaperTrail',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(wrapper.text()).toContain('1 match across searchable text.')
    expect(wrapper.text()).toContain('PaperTrail searchable text')

    await searchInput.trigger('keydown', { key: 'c' })
    expect(wrapper.find('#pdf-contents-title').exists()).toBe(false)

    await searchInput.trigger('keydown', { key: 'Escape' })
    await wrapper.trigger('keydown', { key: '?' })
    await flushPromises()
    expect(wrapper.text()).toContain('Keyboard help')
    expect(wrapper.text()).toContain('Select text from text-based PDFs')
    wrapper.unmount()
  })

  it('reconstructs directory-input hierarchy from relative paths', async () => {
    const { wrapper } = await mountApp('/app')
    const directoryInput = wrapper.get('input[webkitdirectory]')
    const files = [
      folderFile('guide.pdf', 'Reading/guide.pdf'),
      folderFile('book.epub', 'Reading/Books/book.epub'),
    ]

    inputFiles(directoryInput.element, files)
    await directoryInput.trigger('change')
    await finishDiscovery()

    const localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
    expect(localLibrary.text()).toContain('Reading')
    expect(localLibrary.text()).toContain('Books')
    expect(localLibrary.text()).toContain('guide.pdf')
    expect(localLibrary.text()).toContain('book.epub')

    const folderButtons = localLibrary.findAll('button[aria-expanded]')
    expect(folderButtons.map((button) => button.text())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Reading'),
        expect.stringContaining('Books'),
      ]),
    )

    const reselect = wrapper.findAll('button').find((button) => button.text() === 'Reselect folder')
    expect(reselect).toBeTruthy()
    wrapper.unmount()
  })

  it('refreshes a live directory handle and preserves the selected path', async () => {
    const pickerWindow = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
    }
    const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    const originalPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker')
    let scan = 0
    let wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'] | null = null

    const handle = {
      kind: 'directory',
      name: 'Reading',
      async *entries() {
        scan += 1
        const version = scan
        const file = new File([`version-${version}`], 'guide.pdf', {
          lastModified: version,
        })
        const fileHandle = {
          kind: 'file',
          name: 'guide.pdf',
          getFile: async () => file,
        } as unknown as FileSystemFileHandle
        yield ['guide.pdf', fileHandle] as [string, FileSystemHandle]
      },
    } as unknown as FileSystemDirectoryHandle

    try {
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: true,
      })
      Object.defineProperty(pickerWindow, 'showDirectoryPicker', {
        configurable: true,
        value: vi.fn().mockResolvedValue(handle),
      })

      ;({ wrapper } = await mountApp('/app'))
      await wrapper.get('button[aria-label="Add local documents"]').trigger('click')
      const chooseFolder = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Choose folder')!
      await chooseFolder.trigger('click')
      await finishDiscovery()

      let localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
      let guide = localLibrary
        .findAll('button')
        .find((button) => button.text().includes('guide.pdf'))!
      await guide.trigger('click')
      expect(guide.attributes('aria-pressed')).toBe('true')

      const refresh = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Refresh folder')!
      await refresh.trigger('click')
      await finishDiscovery()

      localLibrary = wrapper.get('section[aria-labelledby="local-library-title"]')
      guide = localLibrary.findAll('button').find((button) => button.text().includes('guide.pdf'))!
      expect(guide.attributes('aria-pressed')).toBe('true')
      expect(scan).toBe(2)
    } finally {
      wrapper?.unmount()
      if (originalSecure) Object.defineProperty(window, 'isSecureContext', originalSecure)
      else Reflect.deleteProperty(window, 'isSecureContext')

      if (originalPicker) Object.defineProperty(window, 'showDirectoryPicker', originalPicker)
      else delete pickerWindow.showDirectoryPicker
    }
  })
})

describe('compact library actions', () => {
  it('keeps the floating opener exclusive and moves focus through close and open', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.find('button[aria-label="Show library"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Hide library"]').trigger('click')
    await flushPromises()
    const opener = wrapper.get('button[aria-label="Show library"]')
    expect(document.activeElement).toBe(opener.element)
    await opener.trigger('click')
    await flushPromises()
    expect(wrapper.find('button[aria-label="Show library"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('button[aria-label="Hide library"]').element)
    wrapper.unmount()
  })
  it('dismisses the source menu with Escape without closing the library and dismisses outside clicks', async () => {
    const { wrapper } = await mountApp('/app')
    const plus = wrapper.get('button[aria-label="Add local documents"]')
    await plus.trigger('click')
    await flushPromises()
    const items = wrapper.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(items[0]!.element)
    await items[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1]!.element)
    await items[1]!.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(document.activeElement).toBe(plus.element)
    await plus.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

it('allows cancellation during the minimum loading display without waiting three seconds', async () => {
  const { wrapper } = await mountApp('/app')
  const input = wrapper.get('input[accept*=".pdf"]')
  inputFiles(input.element, [new File(['file'], 'cancel.pdf')])
  await input.trigger('change')
  await flushPromises()
  expect(wrapper.get('.library-list').attributes('aria-busy')).toBe('true')
  expect(wrapper.text()).toContain('Loading your library')
  await wrapper.get('.library-list button').trigger('click')
  await flushPromises()
  expect(wrapper.get('.library-list').attributes('aria-busy')).toBe('false')
  expect(wrapper.text()).not.toContain('Loading your library')
  expect(wrapper.text()).toContain('cancel.pdf')
  wrapper.unmount()
})

it('publishes access problems immediately rather than hiding them behind the minimum delay', async () => {
  const discover = vi.spyOn(discovery, 'discoverDocuments').mockResolvedValue({
    status: 'completed',
    documents: [],
    problems: [{ path: 'locked.pdf', code: 'read-failed', message: 'Unavailable' }],
    scanned: 1,
  })
  const { wrapper } = await mountApp('/app')
  try {
    const input = wrapper.get('input[accept*=".pdf"]')
    inputFiles(input.element, [new File(['file'], 'locked.pdf')])
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.get('.library-list').attributes('aria-busy')).toBe('false')
    expect(wrapper.text()).toContain('1 access issue(s)')
    expect(wrapper.text()).not.toContain('Loading your library')
  } finally {
    wrapper.unmount()
    discover.mockRestore()
  }
})

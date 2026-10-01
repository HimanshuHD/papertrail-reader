import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfSessionMocks = vi.hoisted(() => ({
  open: vi.fn(),
  render: vi.fn(),
  close: vi.fn(),
}))

vi.mock('../../src/features/pdf/pdf-session', () => {
  class PdfOpenError extends Error {}
  return {
    PdfOpenError,
    openPdfDocument: pdfSessionMocks.open,
  }
})
import App from '../../src/App.vue'
import ShellStatus from '../../src/components/viewer/ShellStatus.vue'
import ReaderView from '../../src/views/ReaderView.vue'
import { createAppRouter } from '../../src/router'

beforeEach(() => {
  vi.clearAllMocks()
  pdfSessionMocks.render.mockResolvedValue({ scale: 1.25, width: 765, height: 990 })
  pdfSessionMocks.open.mockImplementation(async () => ({
    totalPages: 3,
    render: pdfSessionMocks.render,
    close: pdfSessionMocks.close,
  }))
})

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

  it('collapses and restores the sidebar without losing selected sample metadata', async () => {
    const { wrapper } = await mountApp('/app')
    const epub = wrapper
      .findAll('nav button')
      .find((button) => button.text().includes('The next chapter'))!
    await epub.trigger('click')
    expect(epub.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('#reader-title').text()).toBe('The next chapter')
    expect(wrapper.text()).toContain('Font size')
    const toggle = wrapper.get('button[aria-controls="document-sidebar"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('aside').exists()).toBe(false)
    await toggle.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.get('#reader-title').text()).toBe('The next chapter')
    wrapper.unmount()
  })

  it('closes the library with Escape and restores focus to its toggle', async () => {
    const { wrapper } = await mountApp('/app')
    const documentButton = wrapper.get('nav button')
    ;(documentButton.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(documentButton.element)
    await documentButton.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    const toggle = wrapper.get('button[aria-controls="document-sidebar"]')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(document.activeElement).toBe(toggle.element)
    expect(wrapper.get('p.sr-only[aria-live="polite"]').text()).toBe('Library hidden.')
    wrapper.unmount()
  })

  it('announces sample selection changes without moving focus', async () => {
    const { wrapper } = await mountApp('/app')
    const epub = wrapper
      .findAll('nav button')
      .find((button) => button.text().includes('The next chapter'))!
    ;(epub.element as HTMLButtonElement).focus()
    await epub.trigger('click')
    expect(document.activeElement).toBe(epub.element)
    expect(wrapper.get('p.sr-only[aria-live="polite"]').text()).toBe(
      'Selected sample: The next chapter.',
    )
    wrapper.unmount()
  })

  it.each([
    ['empty', 'No documents selected', 'status'],
    ['loading', 'Preparing your library', 'status'],
    ['error', 'PaperTrail could not prepare the library', 'alert'],
    ['demo', 'Demonstration workspace', 'status'],
  ] as const)(
    'presents the %s shell state with an accessible announcement',
    (state, text, role) => {
      const wrapper = mount(ShellStatus, { props: { state } })
      expect(wrapper.get(`[role="${role}"]`).text()).toContain(text)
      wrapper.unmount()
    },
  )

  it('offers browser selection while keeping unavailable reader actions disabled', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.text()).toContain('PaperTrail only receives files you explicitly choose')
    expect(wrapper.text()).toContain('does not open a document')
    expect(wrapper.text()).toContain('Demonstration workspace')
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(2)
    const folderButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Choose folder')
    expect(folderButton).toBeTruthy()
    expect(folderButton!.attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('button:disabled')).toHaveLength(2)
    wrapper.unmount()
  })

  it('uses the directory input fallback when the native directory picker is unavailable', async () => {
    const { wrapper } = await mountApp('/app')
    const directoryInput = wrapper.get('input[webkitdirectory]')
    const click = vi.spyOn(directoryInput.element as HTMLInputElement, 'click')
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
    await flushPromises()

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
    expect(pdfSessionMocks.open).toHaveBeenCalledWith(files[0])
    expect(wrapper.get('#reader-title').text()).toBe('guide.pdf')
    expect(wrapper.text()).toContain('Page 1 of 3')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Next')).toBe(true)

    const next = wrapper.findAll('button').find((button) => button.text() === 'Next')!
    await next.trigger('click')
    await flushPromises()
    expect(pdfSessionMocks.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 2 }),
    )
    expect(wrapper.text()).toContain('Page 2 of 3')

    const book = localLibrary
      .findAll('button')
      .find((button) => button.text().includes('book.epub'))!
    await book.trigger('click')
    await flushPromises()
    expect(pdfSessionMocks.open).toHaveBeenCalledTimes(1)
    expect(pdfSessionMocks.close).toHaveBeenCalled()
    expect(wrapper.get('#reader-title').text()).toBe('Welcome to PaperTrail')

    const reselect = wrapper.findAll('button').find((button) => button.text() === 'Reselect files')!
    await reselect.trigger('click')
    expect(click).toHaveBeenCalledOnce()
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
    await flushPromises()

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
      const chooseFolder = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Choose folder')!
      await chooseFolder.trigger('click')
      await flushPromises()

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
      await flushPromises()

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

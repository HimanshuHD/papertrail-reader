import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PdfReaderWorkspace from '../../src/components/viewer/PdfReaderWorkspace.vue'

const pdfSession = vi.hoisted(() => ({
  getOutline: vi.fn(),
  searchText: vi.fn(),
  close: vi.fn(),
  openPdfDocument: vi.fn(),
}))

vi.mock('../../src/features/pdf/pdf-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/pdf/pdf-session')>()),
  openPdfDocument: pdfSession.openPdfDocument,
  PdfOpenError: class PdfOpenError extends Error {},
}))

const continuity = vi.hoisted(() => ({ restore: vi.fn(), save: vi.fn(), reset: vi.fn() }))
vi.mock('../../src/composables/useReadingContinuity', () => ({
  useReadingContinuity: () => ({ ...continuity, notice: ref('') }),
}))

const documentFile = new File(['pdf data'], 'a-very-long-document-name-that-needs-ellipsis.pdf', {
  type: 'application/pdf',
})

function mountReader() {
  return mount(PdfReaderWorkspace, {
    attachTo: document.body,
    props: {
      document: {
        id: 'file-input:long.pdf:8:1:1',
        name: documentFile.name,
        format: 'PDF',
        relativePath: documentFile.name,
        parentPath: '',
        source: 'file-input',
        file: documentFile,
      },
    },
    global: {
      stubs: {
        PdfPageView: {
          props: ['pageNumber'],
          mounted() {
            this.$emit('rendered', this.pageNumber, 1)
          },
          template: '<div />',
        },
      },
    },
  })
}

const wrappers: ReturnType<typeof mountReader>[] = []

describe('PDF reader utility workspace', () => {
  beforeEach(() => {
    continuity.restore.mockResolvedValue(null)
    pdfSession.getOutline.mockResolvedValue([
      { title: 'Introduction', pageNumber: 2, children: [] },
    ])
    pdfSession.searchText.mockResolvedValue({
      matches: [{ pageNumber: 3, excerpt: 'Matching text', occurrence: 0 }],
      textPageCount: 1,
      truncated: false,
    })
    pdfSession.close.mockResolvedValue(undefined)
    pdfSession.openPdfDocument.mockResolvedValue({
      totalPages: 3,
      getPageDimensions: vi.fn().mockResolvedValue({ width: 600, height: 800 }),
      getOutline: pdfSession.getOutline,
      searchText: pdfSession.searchText,
      close: pdfSession.close,
    })
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.clearAllMocks()
  })

  it('keeps pages hidden until saved state and the target bitmap are ready', async () => {
    let finish!: (state: { page: number; view: { fitMode: 'custom'; zoom: number } }) => void
    continuity.restore.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'PdfPageView' })).toHaveLength(0)
    expect(wrapper.get('[aria-label="PDF pages"]').attributes('aria-busy')).toBe('true')
    finish({ page: 3, view: { fitMode: 'custom', zoom: 1.5 } })
    await flushPromises()
    expect(wrapper.get('[aria-label="PDF pages"]').attributes('aria-busy')).toBe('false')
    expect(wrapper.text()).toContain('Page 3 of 3')
    expect(continuity.save).toHaveBeenCalledWith(3, { fitMode: 'custom', zoom: 1.5 })
  })

  it('truncates a long filename while preserving the full name for assistive and hover access', async () => {
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()

    const title = wrapper.get('#reader-title')
    expect(title.classes()).toContain('truncate')
    expect(title.attributes('title')).toBe(documentFile.name)
    expect(title.attributes('aria-label')).toBe(documentFile.name)
  })

  it('shows outline and search results in a separate right-side panel', async () => {
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()

    await wrapper.get('button[aria-label="Contents"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="PDF contents panel"]').text()).toContain('Introduction')

    await wrapper.get('button[aria-label="Search PDF"]').trigger('click')
    const searchInput = wrapper.get('input[aria-label="Search PDF text"]')
    await searchInput.setValue('matching')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[aria-label="PDF search results panel"]').text()).toContain('Matching text')
    expect(wrapper.findAll('[aria-label="PDF search results panel"] li')).toHaveLength(1)
    expect(wrapper.find('input[aria-label="Search PDF text"]').exists()).toBe(false)
    expect(wrapper.findAll('li')).toHaveLength(1)
  })

  it('closes the search popover on Escape and returns focus to its toolbar control', async () => {
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    const searchButton = wrapper.get('button[aria-label="Search PDF"]')

    await searchButton.trigger('click')
    expect(wrapper.find('input[aria-label="Search PDF text"]').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('input[aria-label="Search PDF text"]').exists()).toBe(false)
    expect(document.activeElement).toBe(searchButton.element)
    expect(wrapper.find('[aria-label="PDF search results panel"]').exists()).toBe(false)
  })
  it('keeps search in its popover until results arrive and shows a loading submit control', async () => {
    let finish!: (value: unknown) => void
    pdfSession.searchText.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('button[aria-label="Search PDF"]').trigger('click')
    expect(wrapper.find('[aria-label="PDF search results panel"]').exists()).toBe(false)
    await wrapper.get('input[aria-label="Search PDF text"]').setValue('matching')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.search-spinner').exists()).toBe(true)
    expect(wrapper.find('[aria-label="PDF search results panel"]').exists()).toBe(false)
    finish({ matches: [], textPageCount: 1, truncated: false })
    await flushPromises()
    expect(wrapper.find('[aria-label="PDF search results panel"]').exists()).toBe(true)
  })

  it('keeps failed searches in the popover without opening a results panel', async () => {
    pdfSession.searchText.mockRejectedValueOnce(new Error('search failed'))
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('button[aria-label="Search PDF"]').trigger('click')
    await wrapper.get('input[aria-label="Search PDF text"]').setValue('matching')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[aria-label="PDF search results panel"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Please try again.')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('uses one accessible below-button tooltip, places Contents last, and omits the slider', async () => {
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    const buttons = wrapper.findAll('[aria-label="PDF reader controls"] button')
    expect(buttons.at(-1)?.attributes('aria-label')).toBe('Contents')
    for (const button of buttons) {
      expect(button.attributes('title')).toBeUndefined()
      expect(button.get('.icon-tooltip').classes()).toContain('top-full')
    }
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
  })
  it('increments zoom from the active fit scale and accumulates rapid clicks', async () => {
    const wrapper = mountReader()
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('button[aria-label="Fit page"]').trigger('click')
    await wrapper.get('button[aria-label="Zoom in"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('50%')
    await wrapper.get('button[aria-label="Zoom in"]').trigger('click')
    await wrapper.get('button[aria-label="Zoom in"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('100%')
  })
})

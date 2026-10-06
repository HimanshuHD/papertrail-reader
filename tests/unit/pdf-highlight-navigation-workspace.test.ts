import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import PdfReaderWorkspace from '../../src/components/viewer/PdfReaderWorkspace.vue'

const digest = 'sha256-chunks-v1:' + 'a'.repeat(64)
vi.mock('../../src/features/pdf/pdf-session', async (original) => ({
  ...(await original<typeof import('../../src/features/pdf/pdf-session')>()),
  openPdfDocument: vi.fn(async () => ({
    totalPages: 3,
    getPageDimensions: vi.fn(async () => ({ width: 600, height: 800 })),
    getOutline: vi.fn(async () => []),
    close: vi.fn(async () => undefined),
  })),
}))
vi.mock('../../src/composables/useReadingContinuity', () => ({
  useReadingContinuity: () => ({
    restore: vi.fn(async () => null),
    save: vi.fn(),
    reset: vi.fn(),
    notice: ref(''),
    fingerprint: ref(digest),
    documentId: ref(null),
  }),
}))
vi.mock('../../src/composables/usePdfHighlights', () => ({
  usePdfHighlights: () => ({
    highlights: ref([
      {
        id: 'saved',
        color: 'yellow',
        selector: {
          version: 1,
          format: 'PDF',
          segments: [
            {
              page: 2,
              text: { start: 0, end: 3, exact: 'One', prefix: '', suffix: '' },
              rectangles: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
            },
          ],
        },
      },
    ]),
    loading: ref(false),
    busy: ref(false),
    notice: ref(''),
    handle: ref(null),
  }),
}))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
async function reader() {
  const wrapper = mount(PdfReaderWorkspace, {
    attachTo: document.body,
    props: {
      document: {
        id: 'file',
        name: 'file.pdf',
        relativePath: 'file.pdf',
        parentPath: '',
        source: 'file-input',
        format: 'PDF',
        file: new File([], 'file.pdf'),
      },
    },
    global: {
      stubs: {
        PdfPageView: {
          name: 'PdfPageView',
          props: ['pageNumber'],
          mounted() {
            this.$emit('rendered', this.pageNumber, 1)
          },
          template:
            '<article :id="`pdf-page-${pageNumber}`" :data-pdf-page="pageNumber" data-render-state="pending"><div class="pdf-page"><div class="textLayer"><span>One</span></div></div></article>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  const pane = wrapper.get<HTMLElement>('[aria-label="PDF pages"]').element
  Object.defineProperties(pane, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 2000 },
  })
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ top: 500, width: 80, height: 20 }],
  })
  pane.scrollTop = 100
  return { wrapper, pane }
}
it('waits for the selected PDF page text layer, then aligns the exact text with top padding', async () => {
  const { wrapper, pane } = await reader()
  await wrapper.get('#pdf-highlight-list').setValue('saved')
  await flushPromises()
  expect(pane.scrollTop).toBe(100)
  wrapper.get('#pdf-page-2').element.setAttribute('data-render-state', 'ready')
  wrapper.findAllComponents({ name: 'PdfPageView' })[1]!.vm.$emit(
    'highlightResolution',
    'saved',
    true,
    2,
  )
  await flushPromises()
  expect(pane.scrollTop).toBe(476)
})
it('does not apply a late highlight jump after a different page navigation', async () => {
  const { wrapper, pane } = await reader()
  await wrapper.get('#pdf-highlight-list').setValue('saved')
  await flushPromises()
  await wrapper.get('input[aria-label="Current page"]').setValue('3')
  await flushPromises()
  pane.scrollTop = 123
  wrapper.get('#pdf-page-2').element.setAttribute('data-render-state', 'ready')
  wrapper.findAllComponents({ name: 'PdfPageView' })[1]!.vm.$emit(
    'highlightResolution',
    'saved',
    true,
    2,
  )
  await flushPromises()
  expect(pane.scrollTop).toBe(123)
})

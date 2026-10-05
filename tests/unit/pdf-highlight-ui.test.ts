import { mount, flushPromises } from '@vue/test-utils'
import { ref, shallowRef } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import PdfReaderWorkspace from '../../src/components/viewer/PdfReaderWorkspace.vue'
import PdfPageView from '../../src/components/viewer/PdfPageView.vue'
import type { PdfDocumentSession } from '../../src/features/pdf/pdf-session'
import type { Annotation } from '../../src/services/annotation-storage'

const digest = 'sha256-chunks-v1:' + 'a'.repeat(64)
const annotation: Annotation = {
  version: 2,
  id: 'one',
  color: 'blue',
  note: '',
  createdAt: 1,
  updatedAt: 1,
  selector: {
    version: 1,
    format: 'PDF',
    segments: [
      {
        page: 1,
        text: { start: 0, end: 3, exact: 'One', prefix: '', suffix: '' },
        rectangles: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
      },
    ],
  },
}
const mocks = vi.hoisted(() => ({ add: vi.fn(), recolor: vi.fn(), remove: vi.fn(), open: vi.fn() }))
let annotations = shallowRef<Annotation[]>([])
vi.mock('../../src/composables/usePdfHighlights', () => ({
  usePdfHighlights: () => ({
    highlights: annotations,
    handle: ref({}),
    loading: ref(false),
    busy: ref(false),
    notice: ref(''),
    add: mocks.add,
    recolor: mocks.recolor,
    remove: mocks.remove,
    reload: vi.fn(),
  }),
}))
vi.mock('../../src/composables/useReadingContinuity', () => ({
  useReadingContinuity: () => ({
    fingerprint: ref('sha256-chunks-v1:' + 'a'.repeat(64)),
    documentId: ref(null),
    notice: ref(''),
    restore: async () => null,
    reset: vi.fn(),
    save: vi.fn(),
  }),
}))
vi.mock('../../src/features/pdf/pdf-session', async (original) => ({
  ...(await original<typeof import('../../src/features/pdf/pdf-session')>()),
  openPdfDocument: mocks.open,
}))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  document.getSelection()?.removeAllRanges()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('exposes keyboard reachable highlight/color/delete controls and keeps mutations in the toolbar', async () => {
  annotations = shallowRef([])
  mocks.open.mockResolvedValue({
    totalPages: 1,
    close: vi.fn(),
    getPageDimensions: async () => ({ width: 100, height: 200 }),
  })
  const wrapper = mount(PdfReaderWorkspace, {
    attachTo: document.body,
    props: {
      document: {
        id: 'file:one',
        name: 'one.pdf',
        relativePath: 'one.pdf',
        parentPath: '',
        format: 'PDF',
        source: 'file-input',
        file: new File(['pdf'], 'one.pdf'),
      },
    },
    global: {
      stubs: {
        PdfPageView: {
          props: ['pageNumber'],
          mounted() {
            this.$emit('rendered', 1, 1)
          },
          template:
            '<article data-pdf-page="1" data-render-state="ready"><div class="pdf-page"><div class="textLayer"><span>One</span></div></div></article>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  const page = wrapper.get('.pdf-page').element
  vi.spyOn(page, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 200,
    width: 100,
    height: 200,
  } as DOMRect)
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ left: 10, top: 10, right: 30, bottom: 30 }],
  })
  const range = document.createRange()
  const text = wrapper.get('.textLayer span').element.firstChild!
  range.setStart(text, 0)
  range.setEnd(text, 3)
  document.getSelection()!.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await wrapper.vm.$nextTick()
  const button = wrapper.findAll('button').find((b) => b.text() === 'Highlight selection')!
  expect(button.attributes('disabled')).toBeUndefined()
  button.element.focus()
  await wrapper.get('.textLayer').trigger('pointerdown')
  await wrapper.vm.$nextTick()
  expect(button.attributes('disabled')).toBeDefined()
  const freshRange = document.createRange()
  freshRange.selectNodeContents(text)
  document.getSelection()!.removeAllRanges()
  document.getSelection()!.addRange(freshRange)
  document.dispatchEvent(new Event('selectionchange'))
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new Event('selectionchange'))
  mocks.add.mockImplementation(async () => {
    annotations.value = [annotation]
    return true
  })
  await button.trigger('click')
  await flushPromises()
  expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ format: 'PDF' }), 'yellow')
  await wrapper.get('#pdf-highlight-color').setValue('pink')
  await flushPromises()
  expect(mocks.recolor).toHaveBeenCalledWith('one', 'pink')
  const remove = wrapper.findAll('button').find((b) => b.text() === 'Delete highlight')!
  mocks.remove.mockResolvedValue(true)
  await remove.trigger('click')
  await flushPromises()
  expect(mocks.remove).toHaveBeenCalledWith('one')
  expect(wrapper.get('#pdf-highlight-list').element).toBeInstanceOf(HTMLSelectElement)
})
it('rebuilds saved overlays after zoom and avoids painting a mismatched text anchor', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ left: 10, top: 20, right: 30, bottom: 40 }],
  })
  const session = {
    getPageDimensions: async () => ({ width: 100, height: 200 }),
    render: vi.fn(async (r) => {
      r.textLayer.innerHTML = '<span>One</span>'
      return { scale: 1, width: 100, height: 200 }
    }),
  } as unknown as PdfDocumentSession
  const wrapper = mount(PdfPageView, {
    props: {
      session,
      pageNumber: 1,
      fitMode: 'width',
      zoom: 1,
      availableWidth: 100,
      availableHeight: 200,
      scrollRoot: null,
      annotations: [annotation],
      fingerprint: digest,
    },
  })
  wrappers.push(wrapper)
  vi.spyOn(wrapper.get('.pdf-page').element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 200,
    width: 100,
    height: 200,
  } as DOMRect)
  await flushPromises()
  expect(wrapper.findAll('.pdf-saved-highlight')).toHaveLength(1)
  expect(wrapper.get('.pdf-saved-highlight').attributes('style')).toContain('rgb(191, 219, 254)')
  await wrapper.setProps({ availableWidth: 150 })
  await flushPromises()
  expect(wrapper.findAll('.pdf-saved-highlight')).toHaveLength(1)
  const bad = {
    ...annotation,
    selector: {
      ...annotation.selector,
      segments: [
        {
          ...(annotation.selector.format === 'PDF' ? annotation.selector.segments[0]! : {}),
          text: { start: 0, end: 3, exact: 'Two', prefix: '', suffix: '' },
        },
      ],
    },
  } as Annotation
  await wrapper.setProps({ annotations: [bad] })
  await flushPromises()
  expect(wrapper.findAll('.pdf-saved-highlight')).toHaveLength(0)
  expect(wrapper.emitted('highlightResolution')?.at(-1)).toEqual(['one', false, 1])
})

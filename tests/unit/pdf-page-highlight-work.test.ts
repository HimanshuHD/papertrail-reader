import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PdfPageView from '../../src/components/viewer/PdfPageView.vue'
import type { PdfDocumentSession } from '../../src/features/pdf/pdf-session'
import type { Annotation } from '../../src/services/annotation-storage'

const digest = 'sha256-chunks-v1:' + 'a'.repeat(64)
const wrappers: ReturnType<typeof mount>[] = []
function annotation(id: string, page = 1): Annotation {
  return {
    version: 2,
    id,
    color: 'yellow',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    selector: {
      version: 1,
      format: 'PDF',
      segments: [
        {
          page,
          text: { start: 0, end: 3, exact: 'One', prefix: '', suffix: ' Two' },
          rectangles: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
        },
      ],
    },
  }
}
function mountPage() {
  const wrapper = mount(PdfPageView, {
    props: {
      session: {
        render: vi.fn(async (request: { textLayer: HTMLElement }) => {
          request.textLayer.innerHTML = '<span>One Two</span>'
          return { width: 400, height: 600, scale: 1 }
        }),
        getPageDimensions: vi.fn(async () => ({ width: 400, height: 600 })),
      } as unknown as PdfDocumentSession,
      pageNumber: 1,
      fitMode: 'width',
      zoom: 1,
      availableWidth: 400,
      availableHeight: 600,
      fingerprint: digest,
      annotations: [],
      scrollRoot: null,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 400, 600),
  )
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [new DOMRect(10, 20, 60, 10)],
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Range.prototype, 'getClientRects')
})
it('does not index a ready page without annotations or with annotations for another page', async () => {
  const walk = vi.spyOn(document, 'createTreeWalker')
  const wrapper = mountPage()
  await flushPromises()
  const layer = wrapper.get('.textLayer').element
  expect(walk.mock.calls.filter(([root]) => root === layer)).toHaveLength(0)
  await wrapper.setProps({ annotations: [annotation('other', 2)] })
  await flushPromises()
  expect(walk.mock.calls.filter(([root]) => root === layer)).toHaveLength(0)
})
it('shares one transient page index across all saved highlight ranges in a repaint', async () => {
  const wrapper = mountPage()
  await flushPromises()
  const walk = vi.spyOn(document, 'createTreeWalker')
  await wrapper.setProps({ annotations: [annotation('one'), annotation('two')] })
  await flushPromises()
  const layer = wrapper.get('.textLayer').element
  expect(walk.mock.calls.filter(([root]) => root === layer)).toHaveLength(1)
  expect(wrapper.emitted('highlightResolution')).toContainEqual(['one', true, 1])
  expect(wrapper.emitted('highlightResolution')).toContainEqual(['two', true, 1])
})

it('rebuilds its transient index after text-layer replacement instead of retaining stale nodes', async () => {
  const wrapper = mountPage()
  await flushPromises()
  await wrapper.setProps({ annotations: [annotation('old')] })
  await flushPromises()
  wrapper.get('.textLayer').element.textContent = 'New Two'
  const changed = annotation('fresh')
  if (changed.selector.format !== 'PDF') throw Error('Expected PDF fixture')
  changed.selector.segments[0]!.text.exact = 'New'
  await wrapper.setProps({ annotations: [changed] })
  await flushPromises()
  expect(wrapper.emitted('highlightResolution')).toContainEqual(['fresh', true, 1])
})

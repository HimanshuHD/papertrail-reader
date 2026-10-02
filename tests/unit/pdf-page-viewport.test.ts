import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PdfPageView from '../../src/components/viewer/PdfPageView.vue'
import type { PdfDocumentSession } from '../../src/features/pdf/pdf-session'

afterEach(() => vi.unstubAllGlobals())

describe('PDF viewport ownership', () => {
  it('prefetches inside the PDF pane without reporting offscreen pages as current and releases observers', async () => {
    const observers: {
      callback: IntersectionObserverCallback
      options: IntersectionObserverInit
      disconnect: ReturnType<typeof vi.fn>
    }[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn()
        observe = vi.fn()
        constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
          observers.push({ callback, options, disconnect: this.disconnect })
        }
      },
    )
    const pane = document.createElement('section')
    const render = vi.fn().mockResolvedValue({ width: 400, height: 600, scale: 1 })
    const wrapper = mount(PdfPageView, {
      props: {
        session: { render } as unknown as PdfDocumentSession,
        pageNumber: 1,
        fitMode: 'width',
        zoom: 1,
        availableWidth: 400,
        availableHeight: 600,
        scrollRoot: pane,
      },
    })
    expect(observers).toHaveLength(2)
    expect(observers.every((o) => o.options.root === pane)).toBe(true)
    const entry = { isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry
    observers[0]!.callback([entry], {} as IntersectionObserver)
    await flushPromises()
    expect(render).toHaveBeenCalledOnce()
    expect(wrapper.emitted('visibility')).toBeUndefined()
    observers[1]!.callback([entry], {} as IntersectionObserver)
    expect(wrapper.emitted('visibility')).toEqual([[1, 0.5]])
    wrapper.unmount()
    expect(observers.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true)
  })
})

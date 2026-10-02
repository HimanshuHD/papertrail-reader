import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PdfPageView from '../../src/components/viewer/PdfPageView.vue'
import type { PdfDocumentSession } from '../../src/features/pdf/pdf-session'

beforeEach(() =>
  vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D),
)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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
        session: {
          render,
          getPageDimensions: vi.fn().mockResolvedValue({ width: 400, height: 600 }),
        } as unknown as PdfDocumentSession,
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
    observers[0]!.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    observers[0]!.callback([entry], {} as IntersectionObserver)
    await flushPromises()
    expect(render).toHaveBeenCalledOnce()
    observers[0]!.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.setProps({ availableWidth: 300 })
    expect(wrapper.get('.pdf-page').attributes('style')).toContain('width: 300px')
    expect(render).toHaveBeenCalledOnce()
    observers[0]!.callback([entry], {} as IntersectionObserver)
    await flushPromises()
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1]![0].availableWidth).toBe(300)
    expect(wrapper.emitted('visibility')).toBeUndefined()
    observers[1]!.callback([entry], {} as IntersectionObserver)
    expect(wrapper.emitted('visibility')).toEqual([[1, 0.5]])
    wrapper.unmount()
    expect(observers.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true)
  })
})

it('reserves measured geometry while drawing and serializes invalidated renders', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  let finish!: (value: { width: number; height: number; scale: number }) => void
  const render = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue({ width: 300, height: 450, scale: 0.75 })
  const wrapper = mount(PdfPageView, {
    props: {
      session: {
        render,
        getPageDimensions: vi.fn().mockResolvedValue({ width: 400, height: 600 }),
      } as unknown as PdfDocumentSession,
      pageNumber: 1,
      fitMode: 'width',
      zoom: 1,
      availableWidth: 400,
      availableHeight: 600,
      scrollRoot: null,
    },
  })
  await flushPromises()
  expect(wrapper.get('.pdf-page').attributes('style')).toContain('height: 600px')
  expect(wrapper.get('canvas').attributes('style')).toContain('hidden')
  await wrapper.setProps({ availableWidth: 300 })
  expect(render).toHaveBeenCalledOnce()
  expect(wrapper.get('.pdf-page').attributes('style')).toContain('height: 450px')
  finish({ width: 400, height: 600, scale: 1 })
  await flushPromises()
  expect(render).toHaveBeenCalledTimes(2)
  expect(wrapper.emitted('rendered')).toEqual([[1, 0.75]])
  expect(wrapper.get('canvas').attributes('style')).toContain('visible')
  wrapper.unmount()
})

it('keeps the completed bitmap visible while the next zoom render is pending', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  let finish!: (value: { width: number; height: number; scale: number }) => void
  const render = vi
    .fn()
    .mockResolvedValueOnce({ width: 400, height: 600, scale: 1 })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
  const wrapper = mount(PdfPageView, {
    props: {
      session: {
        render,
        getPageDimensions: vi.fn().mockResolvedValue({ width: 400, height: 600 }),
      } as unknown as PdfDocumentSession,
      pageNumber: 1,
      fitMode: 'width',
      zoom: 1,
      availableWidth: 400,
      availableHeight: 600,
      scrollRoot: null,
    },
  })
  await flushPromises()
  const displayed = wrapper.get('canvas').element
  expect(render.mock.calls[0]![0].canvas).not.toBe(displayed)
  await wrapper.setProps({ fitMode: 'custom', zoom: 1.5 })
  expect(wrapper.get('canvas').attributes('style')).toContain('visible')
  expect(wrapper.text()).not.toContain('Rendering page')
  finish({ width: 600, height: 900, scale: 1.5 })
  await flushPromises()
  expect(wrapper.emitted('rendered')).toEqual([
    [1, 1],
    [1, 1.5],
  ])
  wrapper.unmount()
})

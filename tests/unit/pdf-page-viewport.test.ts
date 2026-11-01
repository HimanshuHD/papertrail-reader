import { immediatePdfTracking } from '../fixtures/pdf-tracking'
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
  it('delegates proximity to its workspace and releases its registration', async () => {
    let proximity!: (near: boolean) => void
    const unregister = vi.fn()
    const tracking = {
      register: vi.fn((_element: HTMLElement, _page: number, update: (near: boolean) => void) => {
        proximity = update
        return unregister
      }),
      schedule: vi.fn(),
    }
    const pane = document.createElement('section')
    const listen = vi.spyOn(pane, 'addEventListener')
    const render = vi.fn().mockResolvedValue({ width: 400, height: 600, scale: 1 })
    const wrapper = mount(PdfPageView, {
      props: {
        tracking,
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
    expect(tracking.register).toHaveBeenCalledWith(wrapper.element, 1, expect.any(Function))
    expect(listen).not.toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything())
    expect(render).not.toHaveBeenCalled()
    proximity(true)
    await flushPromises()
    expect(render).toHaveBeenCalledTimes(1)
    proximity(false)
    expect(wrapper.get('canvas').attributes('width')).toBe('0')
    await wrapper.setProps({ availableWidth: 300 })
    expect(wrapper.get('.pdf-page').attributes('style')).toContain('width: 300px')
    expect(render).toHaveBeenCalledTimes(1)
    proximity(true)
    await flushPromises()
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1]![0].availableWidth).toBe(300)
    wrapper.unmount()
    expect(unregister).toHaveBeenCalledOnce()
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
      tracking: immediatePdfTracking(),
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
      tracking: immediatePdfTracking(),
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

it('shows a cached page preview before its first full-resolution render finishes', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const preview = document.createElement('canvas')
  preview.width = 100
  preview.height = 150
  const render = vi.fn(() => new Promise(() => undefined))
  const wrapper = mount(PdfPageView, {
    props: {
      tracking: immediatePdfTracking(),
      session: {
        render,
        getPagePreview: () => preview,
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
  expect(wrapper.get('canvas').attributes('style')).toContain('visible')
  expect(wrapper.get('canvas').attributes('width')).toBe('100')
  expect(wrapper.text()).not.toContain('Rendering page')
  wrapper.unmount()
})

import { expect, it, vi } from 'vitest'
import { PdfDocumentSession } from '../../src/features/pdf/pdf-session'
function session(rotated = false) {
  const page = {
    view: [0, 0, 600, 800],
    getViewport: () => ({
      width: rotated ? 800 : 600,
      height: rotated ? 600 : 800,
      transform: rotated ? [0, 1, 1, 0, 0, 0] : [1, 0, 0, -1, 0, 800],
      convertToViewportPoint: (x: number, y: number) => (rotated ? [y, x] : [x, 800 - y]),
    }),
    getAnnotations: vi.fn(async () => [
      { subtype: 'Link', rect: [60, 700, 180, 720], url: 'https://example.com' },
      { subtype: 'Link', rect: [60, 600, 180, 620], dest: 'chapter' },
      { subtype: 'Link', rect: [60, 500, 180, 520], unsafeUrl: 'javascript:alert(1)' },
      { subtype: 'Link', rect: [NaN, 0, 1, 2], url: 'https://example.com' },
      { subtype: 'Widget', rect: [0, 0, 10, 10] },
    ]),
  }
  const doc = {
    numPages: 2,
    getPage: vi.fn(async () => page),
    getDestination: vi.fn(async (name: string) =>
      name === 'chapter' ? [1, { name: 'XYZ' }, 60, 400, null] : null,
    ),
    getPageIndex: vi.fn(async () => 1),
    cleanup: vi.fn(async () => {}),
  }
  return {
    session: new PdfDocumentSession(
      {} as never,
      { destroy: vi.fn(async () => {}) } as never,
      doc as never,
    ),
    page,
  }
}
it('projects only link annotations, maps destinations and blocks unsafe actions', async () => {
  const { session: current } = session()
  const links = await current.getPageLinks(1)
  expect(links).toHaveLength(3)
  expect(links[0]).toMatchObject({
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.025,
    action: { kind: 'external', url: 'https://example.com/' },
  })
  expect(links[1]!.action).toEqual({ kind: 'pdf', destination: 'chapter' })
  expect(links[2]!.action.kind).toBe('blocked')
  await current.close()
})
it('resolves named and explicit destination coordinates without accepting missing/out-of-range targets', async () => {
  const { session: current } = session()
  expect(await current.resolveLinkDestination('chapter')).toEqual({ pageNumber: 2, x: 0.1, y: 0.5 })
  expect(await current.resolveLinkDestination([0, { name: 'Fit' }])).toEqual({ pageNumber: 1 })
  expect(await current.resolveLinkDestination('missing')).toBeNull()
  expect(await current.resolveLinkDestination([5, { name: 'Fit' }])).toBeNull()
  expect(await current.resolveLinkDestination([0, { name: 'Launch' }])).toBeNull()
  await current.close()
})

it('maps single-axis destinations through rotated page coordinates', async () => {
  const { session: current } = session(true)
  expect(await current.resolveLinkDestination([0, { name: 'FitH' }, 400])).toEqual({
    pageNumber: 1,
    x: 0.5,
  })
  expect(await current.resolveLinkDestination([0, { name: 'FitV' }, 60])).toEqual({
    pageNumber: 1,
    y: 0.1,
  })
  await current.close()
})

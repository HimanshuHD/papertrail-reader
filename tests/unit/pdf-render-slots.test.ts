import { expect, it } from 'vitest'
import { PdfRenderSlots } from '../../src/features/pdf/render-slots'

it('bounds admission, preserves FIFO order and waits for explicit backing release', async () => {
  const slots = new PdfRenderSlots(2)
  const a = await slots.acquire({}),
    b = await slots.acquire({})
  const order: string[] = []
  const c = slots.acquire({}).then((release) => {
    order.push('c')
    return release
  })
  const d = slots.acquire({}).then((release) => {
    order.push('d')
    return release
  })
  await Promise.resolve()
  expect(order).toEqual([])
  a()
  a()
  const releaseC = await c
  expect(order).toEqual(['c'])
  b()
  const releaseD = await d
  expect(order).toEqual(['c', 'd'])
  releaseC()
  releaseD()
})
it('removes cancelled queued work without occupying or prematurely releasing active slots', async () => {
  const slots = new PdfRenderSlots(1),
    active = {},
    queued = {}
  const release = await slots.acquire(active)
  const waiting = expect(slots.acquire(queued)).rejects.toMatchObject({
    name: 'RenderingCancelledException',
  })
  slots.cancel(queued)
  await waiting
  slots.cancel(active)
  expect(slots.isCancelled(active)).toBe(true)
  let started = false
  const next = slots.acquire({}).then((release) => {
    started = true
    return release
  })
  await Promise.resolve()
  expect(started).toBe(false)
  release()
  ;(await next)()
})
it('closing rejects queued/new requests and cannot restart admission after late release', async () => {
  const slots = new PdfRenderSlots(1),
    active = {}
  const release = await slots.acquire(active)
  const waiting = expect(slots.acquire({})).rejects.toMatchObject({
    name: 'RenderingCancelledException',
  })
  slots.close()
  slots.close()
  await waiting
  expect(slots.isCancelled(active)).toBe(true)
  release()
  release()
  await expect(slots.acquire({})).rejects.toMatchObject({ name: 'RenderingCancelledException' })
})

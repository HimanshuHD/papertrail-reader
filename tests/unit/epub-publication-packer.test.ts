import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { packPublication } from '../../src/features/epub/publication-packer'
const workers: FakeWorker[] = []
class FakeWorker extends EventTarget {
  terminate = vi.fn()
  postMessage = vi.fn<(files: Record<string, Uint8Array>, buffers: Transferable[]) => void>()
  constructor() {
    super()
    workers.push(this)
  }
}
function expectResources(bytes: Uint8Array, input: Record<string, Uint8Array>) {
  const unpacked = unzipSync(bytes)
  expect(Object.keys(unpacked)).toEqual(Object.keys(input))
  for (const name of Object.keys(input))
    expect(Buffer.from(unpacked[name]!).equals(Buffer.from(input[name]!))).toBe(true)
}
const large = () => ({ 'chapter-0.xhtml': new Uint8Array(4 * 1024 * 1024) })
beforeEach(() => {
  workers.length = 0
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => vi.unstubAllGlobals())
it('keeps small archives synchronous and preserves their exact resource contents', async () => {
  const input = { 'chapter-0.xhtml': new Uint8Array(strToU8('<p>Small chapter</p>')) }
  expectResources(await packPublication(input), input)
  expect(workers).toHaveLength(0)
})
it('transfers unique input buffers and terminates the worker after successful packing', async () => {
  const input = large(),
    work = packPublication(input)
  const worker = workers[0]!
  expect(worker.postMessage).toHaveBeenCalledWith(input, [input['chapter-0.xhtml'].buffer])
  const bytes = zipSync(input, { level: 0 })
  worker.dispatchEvent(new MessageEvent('message', { data: { bytes } }))
  expectResources(await work, input)
  expect(worker.terminate).toHaveBeenCalledOnce()
})
it('terminates aborted packing, removes listeners and ignores a late worker result', async () => {
  const controller = new AbortController()
  const work = packPublication(large(), controller.signal)
  const rejected = expect(work).rejects.toMatchObject({ name: 'AbortError' })
  const worker = workers[0]!,
    remove = vi.spyOn(worker, 'removeEventListener')
  controller.abort()
  await rejected
  worker.dispatchEvent(new MessageEvent('message', { data: { bytes: new Uint8Array(1) } }))
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(remove).toHaveBeenCalledTimes(3)
})
it.each(['error', 'messageerror', 'invalid'])(
  'cleans up on %s and rejects instead of repacking transferred inputs',
  async (kind) => {
    const work = packPublication(large()),
      rejected = expect(work).rejects.toThrow('Unable to prepare EPUB archive.')
    const worker = workers[0]!
    worker.dispatchEvent(
      kind === 'invalid'
        ? new MessageEvent('message', { data: { error: true } })
        : new Event(kind, { cancelable: true }),
    )
    await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
  },
)
it('falls back before any transfer when Worker is unavailable or construction fails', async () => {
  for (const worker of [
    undefined,
    class {
      constructor() {
        throw Error('Unavailable')
      }
    },
  ]) {
    vi.stubGlobal('Worker', worker)
    const input = large()
    expectResources(await packPublication(input), input)
  }
})
it('does not create a worker when already aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(packPublication(large(), controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(workers).toHaveLength(0)
})

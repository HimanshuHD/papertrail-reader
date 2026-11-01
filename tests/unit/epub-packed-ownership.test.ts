import { Blob } from 'node:buffer'
import { expect, it, vi } from 'vitest'
import { createEpubFixture } from '../fixtures/epub'
import { prepareTextPublication } from '../../src/features/epub/publication'
const result = vi.hoisted(() => ({ bytes: undefined as Uint8Array | undefined }))
vi.mock('../../src/features/epub/publication-packer', () => ({
  packPublication: async () => result.bytes!,
}))
it('hands the exclusively owned whole packed buffer to the publication without another archive-sized copy', async () => {
  result.bytes = new Uint8Array([1, 2, 3])
  const book = await prepareTextPublication(
    new Blob([createEpubFixture()]) as unknown as globalThis.Blob,
  )
  try {
    expect(book.bytes).toBe(result.bytes.buffer)
  } finally {
    book.dispose()
  }
})
it('copies only the intended byte window if a packer returns a subarray', async () => {
  const source = new Uint8Array([9, 1, 2, 9])
  result.bytes = source.subarray(1, 3)
  const book = await prepareTextPublication(
    new Blob([createEpubFixture()]) as unknown as globalThis.Blob,
  )
  try {
    expect([...new Uint8Array(book.bytes)]).toEqual([1, 2])
    expect(book.bytes).not.toBe(source.buffer)
  } finally {
    book.dispose()
  }
})

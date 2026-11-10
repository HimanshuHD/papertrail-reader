import { Blob } from 'node:buffer'
import { expect, it } from 'vitest'
import { createLargeSpineEpubFixture } from '../fixtures/epub'
import { preparePublication } from '../../src/features/epub/publication'
const file = (count: number, nav = true) =>
  new Blob([createLargeSpineEpubFixture(count, nav)]) as unknown as globalThis.Blob

for (const count of [844]) {
  it(`prepares ${count} reading-order sections with complete chapter metadata`, async () => {
    const book = await preparePublication(file(count))
    try {
      expect(book.chapters).toHaveLength(count)
      expect(book.chapters.at(-1)?.label).toBe(`Section ${count}`)
      expect(book.contents).toHaveLength(count)
      expect(book.contentsSource).toBe('nav')
      expect(book.contents.at(-1)?.chapter).toBe(count - 1)
      expect(book.contents.at(-1)?.fragment).toBe('passage')
    } finally {
      book.dispose()
    }
  }, 30000)
}
it('rejects an over-limit spine with actionable counts before chapter processing', async () => {
  await expect(preparePublication(file(1025))).rejects.toThrow(
    '1025 linear reading-order sections; the supported limit is 1024',
  )
})
it('distinguishes an empty reading order from an over-limit book', async () => {
  await expect(preparePublication(file(0))).rejects.toThrow('no linear reading-order sections')
})
it('retains all fallback chapter targets when optional navigation is absent', async () => {
  const book = await preparePublication(file(2, false), undefined, true)
  try {
    expect(book.contentsSource).toBe('spine')
    expect(book.contents).toHaveLength(2)
    expect(book.contents.at(-1)?.chapter).toBe(1)
  } finally {
    book.dispose()
  }
}, 30000)
it('cancels while reading a large spine and allows a subsequent preparation', async () => {
  const input = file(844)
  const controller = new AbortController()
  const slice = input.slice.bind(input)
  let reads = 0
  input.slice = (...args) => {
    const chunk = slice(...args)
    const read = chunk.arrayBuffer.bind(chunk)
    chunk.arrayBuffer = async () => {
      const result = await read()
      if (++reads === 30) controller.abort()
      return result
    }
    return chunk
  }
  await expect(preparePublication(input, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(reads).toBe(30)
  const recovered = await preparePublication(file(2))
  expect(recovered.chapters).toHaveLength(2)
  recovered.dispose()
})

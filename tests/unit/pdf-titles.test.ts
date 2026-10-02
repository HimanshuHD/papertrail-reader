import { describe, expect, it, vi } from 'vitest'
import { enrichPdfTitles } from '../../src/features/library/pdf-titles'
import { discoverDocuments } from '../../src/features/library/discovery'

it('enriches PDF labels without changing file identity and leaves EPUB alone', async () => {
  const { documents } = await discoverDocuments({
    kind: 'files',
    source: 'file-input',
    files: [new File(['pdf'], 'one.pdf'), new File(['epub'], 'two.epub')],
  })
  const update = vi.fn()
  const read = vi.fn().mockResolvedValue('A chapter')
  await enrichPdfTitles(documents, new AbortController().signal, update, read)
  expect(read).toHaveBeenCalledOnce()
  expect(read.mock.calls[0]![0]).toBe(documents[0]!.file)
  expect(update).toHaveBeenCalledWith(documents[0]!.id, 'A chapter')
  expect(documents[0]!.name).toBe('one.pdf')
})

describe('metadata selection ownership', () => {
  it('does not publish a late result or read the next file after cancellation', async () => {
    const { documents } = await discoverDocuments({
      kind: 'files',
      source: 'file-input',
      files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')],
    })
    const controller = new AbortController()
    const update = vi.fn()
    let finish!: (title: string) => void
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const running = enrichPdfTitles(documents, controller.signal, update, read)
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    controller.abort()
    finish('Obsolete title')
    await running
    expect(update).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledOnce()
  })
})

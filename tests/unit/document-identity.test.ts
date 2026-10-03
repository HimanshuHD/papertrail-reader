import { File } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { fingerprintDocument } from '../../src/services/document-identity'

afterEach(() => vi.unstubAllGlobals())

it('matches renamed content, detects middle-of-file edits and bounds each byte read', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const bytes = new Uint8Array(3 * 1024 * 1024 + 7)
  const original = new File([bytes], 'original.pdf') as unknown as globalThis.File
  const renamed = new File([bytes], 'renamed.pdf') as unknown as globalThis.File
  const read = vi.spyOn(original, 'slice')
  const fingerprint = await fingerprintDocument(original)
  expect(await fingerprintDocument(renamed)).toBe(fingerprint)
  expect(read.mock.calls.every(([start = 0, end = 0]) => end - start <= 1024 * 1024)).toBe(true)
  bytes[1024 * 1024 + 20] = 1
  const changed = new File([bytes], 'original.pdf') as unknown as globalThis.File
  expect(await fingerprintDocument(changed)).not.toBe(fingerprint)
})

it('stops an abandoned fingerprint before reading bytes', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const file = new File(['document'], 'a.pdf') as unknown as globalThis.File
  const read = vi.spyOn(file, 'slice')
  const controller = new AbortController()
  controller.abort()
  await expect(fingerprintDocument(file, controller.signal)).rejects.toThrow()
  expect(read).not.toHaveBeenCalled()
})

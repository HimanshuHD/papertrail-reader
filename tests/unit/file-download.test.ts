import { afterEach, expect, it, vi } from 'vitest'
import { downloadJson } from '../../src/services/file-download'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('requests JSON downloads and releases each temporary URL and anchor', () => {
  vi.useFakeTimers()
  const createObjectURL = vi
    .fn()
    .mockReturnValueOnce('blob:first')
    .mockReturnValueOnce('blob:second')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const links: { filename: string; url: string; connected: boolean }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    links.push({ filename: this.download, url: this.href, connected: this.isConnected })
  })
  downloadJson('{"a":1}', 'a.json')
  downloadJson('[]', 'b.json')
  expect(links).toEqual([
    { filename: 'a.json', url: 'blob:first', connected: true },
    { filename: 'b.json', url: 'blob:second', connected: true },
  ])
  expect(createObjectURL.mock.calls[0]![0]).toHaveProperty('type', 'application/json;charset=utf-8')
  expect(document.querySelector('a[download]')).toBeNull()
  expect(revokeObjectURL).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(revokeObjectURL.mock.calls).toEqual([['blob:first'], ['blob:second']])
})
it('cleans up even when the browser rejects the click', () => {
  vi.useFakeTimers()
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:failed', revokeObjectURL })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    throw Error('blocked')
  })
  expect(() => downloadJson('{}', 'a.json')).toThrow('blocked')
  expect(document.querySelector('a[download]')).toBeNull()
  vi.runAllTimers()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed')
})

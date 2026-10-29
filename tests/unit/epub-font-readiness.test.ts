import { afterEach, expect, it, vi } from 'vitest'
import { settleBookFonts } from '../../src/features/epub/font-readiness'
afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})
function chapter(load: () => Promise<unknown>) {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const doc = frame.contentDocument!
  const style = doc.createElement('style')
  style.textContent = '@font-face{font-family:Book;src:url(blob:font)}p{color:red}'
  doc.head.append(style)
  const face = { load: vi.fn(load) }
  Object.defineProperty(doc, 'fonts', {
    value: {
      values: () => [face].values(),
      forEach: () => {
        throw new Error('Sandbox callbacks must not be used.')
      },
      ready: Promise.resolve(),
    },
  })
  return { doc, face, style }
}
it('waits for font decoding before returning ready', async () => {
  let release!: () => void
  const { doc, face } = chapter(
    () =>
      new Promise<void>((r) => {
        release = r
      }),
  )
  let ready = false
  const pending = settleBookFonts(doc, new AbortController().signal).then(() => {
    ready = true
  })
  await Promise.resolve()
  expect(ready).toBe(false)
  expect(face.load).toHaveBeenCalledOnce()
  release()
  await pending
  expect(ready).toBe(true)
  expect(doc.head.textContent).toContain('@font-face')
})
it('uses fallback and removes late font rules on timeout without removing layout rules', async () => {
  vi.useFakeTimers()
  const { doc } = chapter(() => new Promise(() => {}))
  const pending = settleBookFonts(doc, new AbortController().signal, 100)
  await vi.advanceTimersByTimeAsync(100)
  expect(await pending).toContain('Fallback fonts')
  expect(
    [...doc.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .map((r) => r.cssText)
      .join(''),
  ).not.toContain('@font-face')
  expect(
    [...doc.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .map((r) => r.cssText)
      .join(''),
  ).toContain('color: red')
  expect(vi.getTimerCount()).toBe(0)
})
it('reports decoder rejection as fallback but propagates cancellation', async () => {
  const failed = chapter(() => Promise.reject(new Error('decoder rejected')))
  expect(await settleBookFonts(failed.doc, new AbortController().signal)).toContain(
    'Fallback fonts',
  )
  vi.useFakeTimers()
  const { doc } = chapter(() => new Promise(() => {})),
    controller = new AbortController()
  const pending = settleBookFonts(doc, controller.signal)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

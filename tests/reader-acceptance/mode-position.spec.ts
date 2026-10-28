import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('mode changes retain the visible passage within a long styled chapter', async ({ page }) => {
  const paragraph = Array.from(
    { length: 180 },
    (_, i) => `Word${i} reading text with <em>inline emphasis</em> and more text. `,
  ).join('')
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Position</title><style>body{font-size:64px;line-height:1.5}p{margin:40px;font-size:64px;line-height:1.5}em{font-size:64px}</style></head><body><h1>Position</h1>${Array.from({ length: 8 }, (_, i) => `<p id="para-${i}">Paragraph ${i}. ${paragraph}</p>`).join('')}</body></html>`
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'position.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  })
  await page.getByRole('button', { name: 'EPUB: position.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  const frame = reader.locator('iframe')
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await frame.evaluate(async (frame) => {
    const d = (frame as HTMLIFrameElement).contentDocument!,
      c = frame.closest('.epub-container')!
    const p = d.querySelector('#para-4')!
    c.dispatchEvent(new WheelEvent('wheel'))
    c.scrollTop +=
      p.getBoundingClientRect().top +
      frame.getBoundingClientRect().top -
      c.getBoundingClientRect().top +
      830
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  const anchor = await frame.evaluate((frame) => {
    const d = (frame as HTMLIFrameElement).contentDocument!,
      c = frame.closest('.epub-container')!,
      f = frame.getBoundingClientRect(),
      v = c.getBoundingClientRect()
    const caret = d.caretRangeFromPoint?.(32, v.top - f.top + 8)
    if (caret?.startContainer.nodeType === Node.TEXT_NODE) {
      const node = caret.startContainer as Text
      const range = d.createRange()
      range.setStart(node, caret.startOffset)
      range.setEnd(node, Math.min(node.length, caret.startOffset + 1))
      const rect = range.getBoundingClientRect()
      if (rect.bottom + f.top > v.top && rect.top + f.top < v.bottom)
        return {
          text: node.data.slice(caret.startOffset, caret.startOffset + 24),
          parent: node
            .parentElement!.closest('[data-reader-node]')!
            .getAttribute('data-reader-node')!,
        }
    }
    const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT)
    let candidate: Node | null
    while ((candidate = walker.nextNode())) {
      const node = candidate as Text
      if (!node.data.trim()) continue
      const range = d.createRange()
      range.selectNodeContents(node)
      const bounds = range.getBoundingClientRect()
      if (bounds.bottom + f.top <= v.top || bounds.top + f.top >= v.bottom) continue
      let low = 0
      let high = node.length - 1
      while (low < high) {
        const mid = Math.floor((low + high) / 2)
        range.setStart(node, mid)
        range.setEnd(node, mid + 1)
        if (range.getBoundingClientRect().bottom + f.top <= v.top) low = mid + 1
        else high = mid
      }
      return {
        text: node.data.slice(low, low + 24),
        parent: node
          .parentElement!.closest('[data-reader-node]')!
          .getAttribute('data-reader-node')!,
      }
    }
    throw new Error('No visible text anchor in generated chapter')
  })
  expect(anchor.text.length).toBeGreaterThan(0)
  for (const checked of ['true', 'false']) {
    await frame.evaluate((f) => f.setAttribute('data-old-mode', 'true'))
    await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
    await expect(reader.locator('iframe[data-old-mode]')).toHaveCount(0)
    await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    await expect
      .poll(() =>
        frame.evaluate((frame, a) => {
          const d = (frame as HTMLIFrameElement).contentDocument!,
            c = frame.closest('.epub-container')!,
            p = d.querySelector(`[data-reader-node="${a.parent}"]`)!
          const w = d.createTreeWalker(p, NodeFilter.SHOW_TEXT)
          let n: Node | null
          while ((n = w.nextNode())) {
            const i = n.textContent!.indexOf(a.text)
            if (i < 0) continue
            const r = d.createRange()
            r.setStart(n, i)
            r.setEnd(n, i + 1)
            const rect = r.getBoundingClientRect(),
              f = frame.getBoundingClientRect(),
              v = c.getBoundingClientRect()
            return rect.bottom + f.top > v.top && rect.top + f.top < v.bottom
          }
          return false
        }, anchor),
      )
      .toBe(true)
    await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
      'aria-checked',
      checked,
    )
  }
})

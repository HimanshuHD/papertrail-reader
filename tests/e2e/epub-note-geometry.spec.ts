import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { settleReaderLayout, waitForWorkspaceReady } from '../fixtures/browser'

for (const mode of ['formatted', 'text'] as const) {
  test(`EPUB note markers stay accurate through cached scrolling, reflow and teardown (${mode})`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'notes.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(
        createEpubFixture({
          chapter:
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Notes</title></head><body><h1>Notes</h1><p id="target">A persistent note passage with enough words to wrap after reflow.</p>' +
            Array.from(
              { length: 200 },
              (_, i) => `<p>Paragraph ${i}. ${'Generated local text. '.repeat(10)}</p>`,
            ).join('') +
            '</body></html>',
        }),
      ),
    })
    await page.getByRole('button', { name: 'EPUB: notes.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader')
    if (mode === 'text')
      await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
    await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    await settleReaderLayout(reader)
    const target = reader.frameLocator('iframe').locator('#target')
    await target.evaluate((element) => {
      const doc = element.ownerDocument,
        range = doc.createRange()
      range.selectNodeContents(element)
      doc.getSelection()!.removeAllRanges()
      doc.getSelection()!.addRange(range)
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await page.locator('textarea').fill('Cached geometry note')
    await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
    const marker = reader.getByRole('button', {
      name: 'Open note: Cached geometry note',
      exact: true,
    })
    const aligned = async () => {
      await expect(marker).toBeVisible()
      await expect
        .poll(async () => {
          const expected = await target.evaluate((element) => {
            const doc = element.ownerDocument,
              range = doc.createRange()
            range.selectNodeContents(element)
            const frame = doc.defaultView!.frameElement as HTMLIFrameElement,
              stage = frame.closest('.epub-stage')!.getBoundingClientRect()
            const r = [...range.getClientRects()].find(
              (r) =>
                r.width > 0 &&
                r.height > 0 &&
                frame.getBoundingClientRect().top + r.bottom > stage.top &&
                frame.getBoundingClientRect().top + r.top < stage.bottom,
            )!
            return Math.max(
              0,
              Math.min(frame.getBoundingClientRect().top + r.top - stage.top, stage.height - 40),
            )
          })
          const actual = await marker.evaluate((el) => parseFloat((el as HTMLElement).style.top))
          return Math.abs(actual - expected)
        })
        .toBeLessThan(1)
    }
    await aligned()
    await target.evaluate((el) => {
      ;(el as HTMLElement).style.transform = 'translateY(40px)'
    })
    await aligned()
    await target.evaluate((el) => {
      ;(el as HTMLElement).style.fontSize = '30px'
    })
    await aligned()
    await target.evaluate((el) => {
      const doc = el.ownerDocument,
        wrapper = doc.createElement('div')
      wrapper.id = 'nested'
      wrapper.style.cssText = 'height:160px;overflow:auto'
      el.before(wrapper)
      const before = doc.createElement('div')
      before.style.height = '60px'
      wrapper.append(before, el)
      const after = doc.createElement('div')
      after.style.height = '400px'
      wrapper.append(after)
    })
    await aligned()
    await reader
      .frameLocator('iframe')
      .locator('#nested')
      .evaluate((el) => {
        el.scrollTop = 30
      })
    await aligned()
    await target.evaluate(async (el) => {
      const animation = el.animate(
        [{ transform: 'translateY(40px)' }, { transform: 'translateY(60px)' }],
        { duration: 80, fill: 'forwards' },
      )
      await animation.finished
    })
    await reader.locator('.epub-container').dispatchEvent('scroll')
    await aligned()
    await marker.click()
    await expect(reader.locator('.annotation-panel')).toContainText('Cached geometry note')
    await page.getByRole('button', { name: 'Close notes.epub', exact: true }).click()
    await expect(reader).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

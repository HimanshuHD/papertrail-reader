import { expect, test } from '@playwright/test'
import { strToU8 } from 'fflate'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

// Same long-single-chapter shape as the reported book; no uploaded content is committed.
const chapter =
  '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body><h1>Long chapter</h1><p id="saved-quote">A short quotation worth keeping.</p>' +
  Array.from(
    { length: 420 },
    (_, index) =>
      `<p>Paragraph ${index}. ${'Local words flow through this long chapter. '.repeat(32)}</p>`,
  ).join('') +
  '</body></html>'

for (const savedHighlight of [false, true]) {
  test(`long EPUB chapter remains navigable ${savedHighlight ? 'with a saved highlight' : 'without highlights'}`, async ({
    page,
  }) => {
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'long-chapter.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ files: { 'OPS/two.xhtml': strToU8(chapter) } })),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: 'EPUB: long-chapter.epub', exact: true })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.getByRole('region', { name: 'EPUB reader', exact: true })
    const frame = reader.frameLocator('iframe')
    await expect(frame.getByRole('heading', { name: 'First chapter', exact: true })).toBeVisible()
    await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
    await expect(frame.getByRole('heading', { name: 'Long chapter', exact: true })).toBeVisible()
    if (savedHighlight) {
      await frame.locator('#saved-quote').evaluate((element) => {
        const range = element.ownerDocument.createRange()
        range.selectNodeContents(element)
        const selection = element.ownerDocument.getSelection()!
        selection.removeAllRanges()
        selection.addRange(range)
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      })
      await page
        .getByRole('group', { name: 'EPUB highlights', exact: true })
        .getByRole('button', { name: 'Add highlight', exact: true })
        .click()
    }
    for (let iteration = 0; iteration < 2; iteration++) {
      await reader.getByRole('button', { name: 'Previous chapter', exact: true }).click()
      await expect(frame.getByRole('heading', { name: 'First chapter', exact: true })).toBeVisible()
      await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
      await expect(frame.getByRole('heading', { name: 'Long chapter', exact: true })).toBeVisible()
      if (savedHighlight) {
        await expect
          .poll(() =>
            reader.locator('iframe').evaluate((frame) => {
              const win = (frame as HTMLIFrameElement).contentWindow as Window & {
                CSS: { highlights: Map<string, { size: number }> }
              }
              return win.CSS.highlights.get('papertrail-yellow')?.size ?? 0
            }),
          )
          .toBe(1)
      }
    }
    if (savedHighlight) {
      const textOnly = reader.getByRole('switch', { name: 'Text-only view', exact: true })
      for (const expected of ['true', 'false']) {
        await textOnly.click()
        await expect(textOnly).toHaveAttribute('aria-checked', expected)
        await expect(
          frame.getByRole('heading', { name: 'Long chapter', exact: true }),
        ).toBeVisible()
        await expect
          .poll(() =>
            reader.locator('iframe').evaluate((frame) => {
              const win = (frame as HTMLIFrameElement).contentWindow as Window & {
                CSS: { highlights: Map<string, { size: number }> }
              }
              return win.CSS.highlights.get('papertrail-yellow')?.size ?? 0
            }),
          )
          .toBe(1)
      }
    }
    await page.getByRole('button', { name: 'Close long-chapter.epub', exact: true }).click()
    await expect(reader).toHaveCount(0)
  })
}

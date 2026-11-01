import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady, settleReaderLayout } from '../fixtures/browser'

for (const mode of ['pdf', 'epub-formatted', 'epub-text'] as const) {
  test(`${mode} hover follows the latest pointer and immediate clicks use fresh highlights`, async ({
    page,
  }) => {
    const pdf = mode === 'pdf'
    const name = pdf ? 'hover.pdf' : 'hover.epub'
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name,
      mimeType: pdf ? 'application/pdf' : 'application/epub+zip',
      buffer: pdf ? createPdfFixture(2) : Buffer.from(createEpubFixture()),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `${pdf ? 'PDF' : 'EPUB'}: ${name}`, exact: true })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator(pdf ? '.pdf-reader' : '.epub-reader')
    if (mode === 'epub-text')
      await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
    await settleReaderLayout(reader)
    if (pdf)
      await expect(reader.locator('[data-pdf-page="1"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
    else await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    const text = pdf
      ? reader.locator('[data-pdf-page="1"] .textLayer span').first()
      : reader.frameLocator('iframe').locator('p').first()
    await expect(text).toBeVisible()
    await text.evaluate((element) => {
      const doc = element.ownerDocument
      const range = doc.createRange()
      range.selectNodeContents(element)
      doc.getSelection()!.removeAllRanges()
      doc.getSelection()!.addRange(range)
      doc.dispatchEvent(new Event('selectionchange'))
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Add highlight', exact: true }).click()
    await expect(page.locator('.toast-host')).toContainText('Highlight saved.')
    const move = async (hit: boolean) =>
      text.evaluate((element, hit) => {
        const doc = element.ownerDocument
        doc.getSelection()?.removeAllRanges()
        const range = doc.createRange()
        range.selectNodeContents(element)
        const rect = range.getClientRects()[0]!
        const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
        for (let i = 0; i < 50; i++)
          element.dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true, clientX: 0, clientY: 0 }),
          )
        if (hit) element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, ...point }))
      }, hit)
    await move(true)
    await expect(text).toHaveAttribute('title', 'Show highlighted text')
    await move(false)
    await expect(text).not.toHaveAttribute('title', 'Show highlighted text')
    // Queue a miss and click the highlight before that frame can run.
    await text.evaluate((element) => {
      const range = element.ownerDocument.createRange()
      range.selectNodeContents(element)
      const rect = range.getClientRects()[0]!
      element.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 0, clientY: 0 }),
      )
      const point = {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }
      element.dispatchEvent(new PointerEvent('pointerdown', point))
      element.dispatchEvent(new PointerEvent('pointerup', point))
    })
    await expect(reader.locator('.annotation-panel [data-annotation-id]')).toHaveCount(1)
  })
}

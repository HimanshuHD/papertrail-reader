import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createLargeSpineEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const format of ['PDF', 'EPUB'] as const) {
  test(`closing ${format} during pending local-file work cannot revive it or block another reader`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    const original =
      format === 'PDF'
        ? { name: 'cancel.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) }
        : {
            name: 'cancel.epub',
            mimeType: 'application/epub+zip',
            buffer: Buffer.from(createLargeSpineEpubFixture()),
          }
    await page
      .locator('input[accept*=".pdf"]')
      .setInputFiles([
        original,
        { name: 'recovery.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(4) },
      ])
    const entry = page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `${format}: ${original.name}`, exact: true })
    await expect(entry).toBeVisible()
    // Test-only pending-work barrier; no application clock or permission API is changed.
    await page.evaluate(() => {
      const read = Blob.prototype.arrayBuffer
      let first = true
      Reflect.set(window, 'acceptanceReadStarted', false)
      Reflect.set(window, 'acceptanceReadFinished', false)
      Blob.prototype.arrayBuffer = async function () {
        // Identity reads before a closable tab exists continue normally. Hold
        // one actual reader input read after its tab has mounted.
        if (
          !first ||
          !document.querySelector('[role="tablist"][aria-label="Open documents"] [role="tab"]')
        )
          return read.call(this)
        first = false
        Reflect.set(window, 'acceptanceReadStarted', true)
        await new Promise<void>((resolve) => Reflect.set(window, 'releaseAcceptanceRead', resolve))
        try {
          return await read.call(this)
        } finally {
          Reflect.set(window, 'acceptanceReadFinished', true)
        }
      }
    })
    await entry.click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'acceptanceReadStarted')))
      .toBe(true)
    await expect(page.locator('.session-panel:not(.session-inactive) .loading-card')).toBeVisible()
    await page.getByRole('button', { name: `Close ${original.name}`, exact: true }).click()
    await expect(
      page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab'),
    ).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, 'releaseAcceptanceRead')())
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'acceptanceReadFinished')))
      .toBe(true)
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: recovery.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expect(
      page.getByRole('spinbutton', { name: 'Current page', exact: true }),
    ).toHaveAttribute('max', '4')
    await expect(
      page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab'),
    ).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: `Close ${original.name}`, exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('.session-panel:not(.session-inactive) .loading-card')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

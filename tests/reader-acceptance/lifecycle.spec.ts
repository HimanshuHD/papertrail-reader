import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

async function open(page: Page, name: string) {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
  await page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
}

test('real five-minute inactivity releases both formats and restores their independent state', async ({
  page,
}, info) => {
  // This new manual case needs five real minutes plus setup/recovery. Existing action timeouts stay unchanged.
  test.setTimeout(390000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'expiry.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(4) },
    { name: 'keeper.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) },
    {
      name: 'expiry.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  const pdf = page.locator('.pdf-reader:visible')
  await open(page, 'PDF: expiry.pdf')
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  const current = pdf.getByRole('spinbutton', { name: 'Current page', exact: true })
  await current.fill('3')
  await current.press('Tab')
  await expect(pdf.locator('[data-pdf-page="3"]')).toHaveAttribute('data-render-state', 'ready')
  await pdf.evaluate((node) => node.setAttribute('data-acceptance-instance', 'original-pdf'))
  await open(page, 'EPUB: expiry.epub')
  const epub = page.locator('.epub-reader:visible')
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'First chapter', exact: true }),
  ).toBeVisible()
  await epub.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'Second chapter', exact: true }),
  ).toBeVisible()
  await epub.evaluate((node) => node.setAttribute('data-acceptance-instance', 'original-epub'))
  await page.getByRole('tab', { name: /PDF: expiry.pdf/ }).click()
  await expect(pdf).toHaveAttribute('data-acceptance-instance', 'original-pdf')
  await expect(current).toHaveValue('3')
  await page.getByRole('tab', { name: /EPUB: expiry.epub/ }).click()
  await expect(epub).toHaveAttribute('data-acceptance-instance', 'original-epub')
  // Lower bounds precede the actual deactivation click; use wall time, not mocked browser timers.
  const epubInactiveLowerBound = Date.now()
  await page.getByRole('tab', { name: /PDF: expiry.pdf/ }).click()
  const pdfInactiveLowerBound = Date.now()
  await open(page, 'PDF: keeper.pdf')
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  let pdfReleasedAt = 0,
    epubReleasedAt = 0
  await expect
    .poll(
      async () => {
        const originalPdf = await page.locator('[data-acceptance-instance="original-pdf"]').count()
        const originalEpub = await page
          .locator('[data-acceptance-instance="original-epub"]')
          .count()
        if (!originalPdf && !pdfReleasedAt) pdfReleasedAt = Date.now()
        if (!originalEpub && !epubReleasedAt) epubReleasedAt = Date.now()
        return [originalPdf, originalEpub]
      },
      {
        timeout: 330000,
        intervals: [1000],
        message: 'Waiting for actual inactivity expiry; no clock acceleration',
      },
    )
    .toEqual([0, 0])
  expect(pdfReleasedAt - pdfInactiveLowerBound).toBeGreaterThanOrEqual(300000)
  expect(epubReleasedAt - epubInactiveLowerBound).toBeGreaterThanOrEqual(300000)
  await expect(page.locator('.pdf-reader')).toHaveCount(1)
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await page.getByRole('tab', { name: /PDF: expiry.pdf/ }).click()
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  await expect(current).toHaveValue('3')
  await expect(pdf).not.toHaveAttribute('data-acceptance-instance', 'original-pdf')
  await page.getByRole('tab', { name: /EPUB: expiry.epub/ }).click()
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'Second chapter', exact: true }),
  ).toBeVisible()
  await expect(epub).not.toHaveAttribute('data-acceptance-instance', 'original-epub')
  while (await page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab').count())
    await page.getByRole('tab', { selected: true }).press('Delete')
  await expect(page.locator('.pdf-reader, .epub-reader')).toHaveCount(0)
  expect(errors).toEqual([])
  await info.attach('real-expiry-functional-evidence', {
    body: JSON.stringify({
      mechanism: 'real-clock',
      formats: ['PDF', 'EPUB'],
      warmIdentityPreserved: true,
      expiredInstancesReleased: true,
      stateRestored: true,
      closedRootsRemoved: true,
    }),
    contentType: 'application/json',
  })
})

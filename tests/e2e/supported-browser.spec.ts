import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createFormattedEpubFixture } from '../fixtures/epub'

test('local PDF and formatted EPUB remain readable through reselection and reload', async ({
  page,
  browser,
}, info) => {
  info.annotations.push({ type: 'browser-version', description: browser.version() })
  const requests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1')
      requests.push(request.url())
  })
  await page.goto('./#/app')
  const pdf = { name: 'support.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) }
  const epub = {
    name: 'support.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createFormattedEpubFixture()),
  }
  const open = async (file: typeof pdf) => {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(file)
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: new RegExp(file.name) })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  }
  await open(pdf)
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.locator('#pdf-page-1 .textLayer')).toContainText('First page')
  await page.reload()
  await open(pdf)
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await open(epub)
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'Formatted chapter' })).toBeVisible()
  await expect(frame.getByAltText('Local illustration')).toBeVisible()
  await page.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(frame.getByRole('heading', { name: 'Formatted chapter' })).toBeVisible()
  await page.setViewportSize({ width: 768, height: 900 })
  await expect
    .poll(() =>
      page
        .locator('.epub-container')
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'Local reading insights' })
      .getByRole('button', { name: 'Reset this document’s insights' }),
  ).toBeEnabled()
  await page.screenshot({ path: info.outputPath('supported-reader-dark.png') })
  expect(requests).toEqual([])
})

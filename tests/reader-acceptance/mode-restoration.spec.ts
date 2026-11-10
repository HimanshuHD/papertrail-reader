import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const finalTextOnly of [false, true]) {
  test(`EPUB ${finalTextOnly ? 'text-only' : 'formatted'} view survives warm switches and reload/reconnect`, async ({
    page,
  }) => {
    const files = [
      { name: 'mode.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
      {
        name: 'mode.epub',
        mimeType: 'application/epub+zip',
        buffer: Buffer.from(createEpubFixture()),
      },
    ]
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    await page.getByRole('button', { name: 'EPUB: mode.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader:visible')
    const ready = async () => {
      await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
      await expect(
        reader.frameLocator('iframe').getByRole('heading', { name: 'Second chapter', exact: true }),
      ).toBeVisible()
    }
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: 'First chapter', exact: true }),
    ).toBeVisible()
    await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
    await ready()
    const mode = reader.getByRole('switch', { name: 'Text-only view', exact: true })
    for (const checked of finalTextOnly ? ['true', 'false', 'true'] : ['true', 'false']) {
      await reader.locator('iframe').evaluate((node) => node.setAttribute('data-old-view', 'true'))
      await mode.click()
      await expect(page.locator('iframe[data-old-view]')).toHaveCount(0)
      await ready()
      await expect(mode).toHaveAttribute('aria-checked', checked)
    }
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: mode.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('tab', { name: /EPUB: mode.epub/ }).click()
    await ready()
    await expect(mode).toHaveAttribute('aria-checked', String(finalTextOnly))
    await page.reload()
    await waitForWorkspaceReady(page)
    await page.getByRole('button', { name: 'Reconnect local document', exact: true }).click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await page.getByRole('tab', { name: /EPUB: mode.epub/ }).click()
    await ready()
    await expect(mode).toHaveAttribute('aria-checked', String(finalTextOnly))
  })
}

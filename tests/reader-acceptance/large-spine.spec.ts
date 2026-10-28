import { expect, test } from '@playwright/test'
import { createLargeSpineEpubFixture } from '../fixtures/epub'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const count of [844, 1024]) {
  test(`${count}-section EPUB navigates, retains one reader and restores after reconnect`, async ({
    page,
  }) => {
    test.setTimeout(120000)
    const files = [
      {
        name: 'large.epub',
        mimeType: 'application/epub+zip',
        buffer: Buffer.from(createLargeSpineEpubFixture(count)),
      },
      { name: 'other.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    ]
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    await page.getByRole('button', { name: 'EPUB: large.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader:visible')
    const ready = () =>
      expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
    await ready()
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    const contents = reader.getByRole('navigation', { name: 'EPUB contents', exact: true })
    await expect(contents.getByRole('button')).toHaveCount(count)
    // Exercise keyboard access to the final item in a long Contents list.
    const last = contents.getByRole('button', { name: `Section ${count}`, exact: true })
    await last.focus()
    await last.press('Enter')
    await ready()
    await reader.getByRole('button', { name: 'Close utility panel', exact: true }).click()
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: `Section ${count}`, exact: true }),
    ).toBeVisible()
    await reader.getByRole('button', { name: 'Previous chapter', exact: true }).click()
    await ready()
    await expect(
      reader
        .frameLocator('iframe')
        .getByRole('heading', { name: `Section ${count - 1}`, exact: true }),
    ).toBeVisible()
    await expect(reader.locator('iframe')).toHaveCount(1)
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: other.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('tab', { name: /EPUB: large.epub/ }).click()
    await ready()
    await expect(
      reader
        .frameLocator('iframe')
        .getByRole('heading', { name: `Section ${count - 1}`, exact: true }),
    ).toBeVisible()
    await page.reload()
    await waitForWorkspaceReady(page)
    await page.getByRole('button', { name: 'Reconnect local document', exact: true }).click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    const hide = page.getByRole('button', { name: 'Hide library', exact: true })
    if (await hide.isVisible()) await hide.click()
    await page.getByRole('tab', { name: /EPUB: large.epub/ }).click()
    await ready()
    await expect(
      reader
        .frameLocator('iframe')
        .getByRole('heading', { name: `Section ${count - 1}`, exact: true }),
    ).toBeVisible()
    await expect(reader.locator('iframe')).toHaveCount(1)
  })
}

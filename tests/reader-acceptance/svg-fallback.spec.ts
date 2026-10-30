import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('oversized SVG preserves readable text, modes, chapters and warm tabs', async ({ page }) => {
  // Document rebuilds are functional readiness checks, not five-second performance limits.
  test.setTimeout(90000)
  const files = [
    {
      name: 'illustrated.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(
        createEpubFixture({
          manifest: '<item id="image" href="large.svg" media-type="image/svg+xml"/>',
          chapter:
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Illustrated chapter</title></head><body><h1>Illustrated chapter</h1><img src="large.svg" alt="Map of the journey"/><p>Readable text after the illustration.</p></body></html>',
          files: {
            'OPS/large.svg': new TextEncoder().encode(
              '<svg xmlns="http://www.w3.org/2000/svg"/>'.padEnd(4 * 1024 * 1024 + 1),
            ),
          },
        }),
      ),
    },
    { name: 'other.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
  ]
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles(files)
  await page.getByRole('button', { name: 'EPUB: illustrated.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  const ready = () =>
    expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
  await ready()
  const notice = reader.getByRole('status', { name: 'Illustration notice' })
  await expect(notice).toContainText('4 MiB')
  const noticeTrigger = reader.getByRole('button', { name: 'Rendering information', exact: true })
  await expect(noticeTrigger).toBeVisible()
  await expect
    .poll(() =>
      noticeTrigger.evaluate((button) => {
        const viewport = button
          .closest('.epub-stage')!
          .querySelector<HTMLElement>('.epub-container')!
        const page = viewport.getBoundingClientRect(),
          icon = button.getBoundingClientRect()
        return Math.round(page.left + viewport.clientLeft + viewport.clientWidth - icon.right)
      }),
    )
    .toBe(12)
  await expect
    .poll(() =>
      noticeTrigger.evaluate((button) => {
        const viewport = button
          .closest('.epub-stage')!
          .querySelector<HTMLElement>('.epub-container')!
        return Math.round(
          button.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top -
            viewport.clientTop,
        )
      }),
    )
    .toBe(12)
  await expect(page.getByRole('dialog', { name: 'Illustration availability' })).toHaveCount(0)
  const before = await reader.locator('.epub-host').boundingBox()
  await noticeTrigger.click()
  const details = page.getByRole('dialog', { name: 'Illustration availability', exact: true })
  await expect(details).toContainText('4 MiB')
  await expect(details.getByRole('button', { name: 'Close rendering information' })).toBeFocused()
  expect(await reader.locator('.epub-host').boundingBox()).toEqual(before)
  await page.keyboard.press('Escape')
  await expect(details).toHaveCount(0)
  await expect(noticeTrigger).toBeFocused()
  await expect(
    reader.frameLocator('iframe').getByText('Map of the journey', { exact: true }),
  ).toBeVisible()
  await expect(reader.frameLocator('iframe').locator('img')).toHaveCount(0)
  await expect(
    reader.frameLocator('iframe').getByText('Readable text after the illustration.'),
  ).toBeVisible()
  for (const checked of ['true', 'false']) {
    await reader.locator('iframe').evaluate((frame) => frame.setAttribute('data-old-view', 'true'))
    await reader.getByRole('switch', { name: 'Text-only view' }).click()
    await expect(reader.locator('iframe[data-old-view]')).toHaveCount(0)
    await ready()
    await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
      'aria-checked',
      checked,
    )
    await expect(
      reader.frameLocator('iframe').getByText('Map of the journey', { exact: true }),
    ).toBeVisible()
  }
  await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await ready()
  await expect(noticeTrigger).toHaveCount(0)
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show library', exact: true }).click()
  await page.getByRole('button', { name: 'PDF: other.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 15000 },
  )
  await page.getByRole('tab', { name: /EPUB: illustrated.epub/ }).click()
  await ready()
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await expect(reader.locator('iframe')).toHaveCount(1)
})

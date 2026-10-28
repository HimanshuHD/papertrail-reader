import { expect, test } from '@playwright/test'
import { createImageHeavyEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('195-image book rotates a three-chapter window with a chapter loading cover', async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL)
    const images = new Set<string>()
    let created = 0
    URL.createObjectURL = (blob) => {
      const url = create(blob)
      if (blob instanceof Blob && blob.type.startsWith('image/')) {
        images.add(url)
        created++
      }
      return url
    }
    URL.revokeObjectURL = (url) => {
      images.delete(url)
      revoke(url)
    }
    Reflect.set(window, 'imageOwnership', () => ({ live: images.size, created }))
  })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'illustrated.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createImageHeavyEpubFixture()),
  })
  await page.getByRole('button', { name: 'EPUB: illustrated.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', {
    timeout: 60000,
  })
  await reader.evaluate((element) => {
    Reflect.set(window, 'chapterLoaderCount', 0)
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof Element &&
            (node.matches('.epub-loading-cover') || node.querySelector('.epub-loading-cover'))
          )
            Reflect.set(window, 'chapterLoaderCount', Reflect.get(window, 'chapterLoaderCount') + 1)
    })
    observer.observe(element, { childList: true, subtree: true })
  })
  const ownership = () => page.evaluate(() => Reflect.get(window, 'imageOwnership')())
  for (const [step, chapter] of [1, 2, 3, 2].entries()) {
    await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', {
      timeout: 60000,
    })
    await expect(
      reader
        .frameLocator('iframe')
        .getByRole('heading', { name: `Illustrated section ${chapter}` }),
    ).toBeVisible()
    await expect(reader.frameLocator('iframe').locator('img')).toHaveCount(65)
    await expect.poll(ownership, { timeout: 15000 }).toEqual(
      [
        { live: 130, created: 130 },
        { live: 195, created: 195 },
        { live: 130, created: 195 },
        { live: 195, created: 260 },
      ][step],
    )
    await expect(reader.locator('.epub-loading-cover')).toHaveCount(0)
    await expect(reader.getByRole('status', { name: 'Illustration notice' })).toHaveCount(0)
    if (step < 3)
      await reader
        .getByRole('button', { name: step < 2 ? 'Next chapter' : 'Previous chapter', exact: true })
        .click()
  }
  expect(
    await page.evaluate(() => Reflect.get(window, 'chapterLoaderCount')),
  ).toBeGreaterThanOrEqual(3)
  await page.getByRole('button', { name: 'Close illustrated.epub', exact: true }).click()
  await expect.poll(async () => (await ownership()).live).toBe(0)
})

test('a chapter formatting failure exits loading and permits explicit text-only recovery', async ({
  page,
}) => {
  const { createEpubFixture } = await import('../fixtures/epub')
  const bytes = createEpubFixture({
    manifest: '<item id="css" href="large.css" media-type="text/css"/>',
    chapter:
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Recovery chapter</title><link rel="stylesheet" href="large.css"/></head><body><h1>Recovery chapter</h1><p>Text remains available.</p></body></html>',
    files: { 'OPS/large.css': new TextEncoder().encode('p{color:red}'.padEnd(256 * 1024 + 1)) },
  })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'recovery.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(bytes),
  })
  await page.getByRole('button', { name: 'EPUB: recovery.epub', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  await expect(reader.getByRole('alert')).toContainText('stylesheet')
  await reader.getByRole('button', { name: 'Open text-only view', exact: true }).click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Recovery chapter' }),
  ).toBeVisible()
  await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

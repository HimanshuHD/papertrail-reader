import { expect, test } from '@playwright/test'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { createLargeSpineEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

function largeBook() {
  const files = unzipSync(createLargeSpineEpubFixture(12, false))
  for (let index = 0; index < 12; index++)
    files[`OPS/chapters/${index}.xhtml`] = new Uint8Array(
      strToU8(
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Section ${index + 1}</title></head><body><h1>Section ${index + 1}</h1><p id="passage">${'Generated local chapter text. '.repeat(18000)}</p></body></html>`,
      ),
    )
  return Buffer.from(zipSync(files, { level: 0 }))
}
async function open(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'EPUB: preparation.epub', exact: true }).click()
}

test('large EPUB preparation uses and releases its packer worker while retaining chapter navigation', async ({
  page,
}) => {
  let workers = 0,
    closed = 0
  page.on('worker', (worker) => {
    if (!worker.url().includes('publication-packer')) return
    workers++
    worker.on('close', () => closed++)
  })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'preparation.epub',
    mimeType: 'application/epub+zip',
    buffer: largeBook(),
  })
  await open(page)
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader')
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Section 1', exact: true }),
  ).toBeVisible()
  expect(workers).toBe(1)
  await expect.poll(() => closed).toBe(1)
  await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Section 2', exact: true }),
  ).toBeVisible()
  await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Section 2', exact: true }),
  ).toBeVisible()
  await expect.poll(() => workers).toBe(2)
  await expect.poll(() => closed).toBe(2)
})

test('closing while the packer script is blocked aborts preparation and permits reopening', async ({
  page,
}) => {
  let release!: () => void,
    reached!: () => void,
    first = true
  const blocked = new Promise<void>((resolve) => {
    reached = resolve
  })
  const unblock = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/*publication-packer.worker*.js', async (route) => {
    if (first) {
      first = false
      reached()
      await unblock
    }
    await route.continue().catch(() => {})
  })
  try {
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'preparation.epub',
      mimeType: 'application/epub+zip',
      buffer: largeBook(),
    })
    await open(page)
    await blocked
    await page.getByRole('button', { name: 'Close preparation.epub', exact: true }).click()
    await expect(page.locator('.epub-reader')).toHaveCount(0)
    release()
    await expect
      .poll(
        () => page.workers().filter((worker) => worker.url().includes('publication-packer')).length,
      )
      .toBe(0)
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await open(page)
    await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    await expect(
      page.frameLocator('iframe').getByRole('heading', { name: 'Section 1', exact: true }),
    ).toBeVisible()
  } finally {
    release()
  }
})

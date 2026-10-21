import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('diagnostic attribution distinguishes retained switching from five-minute reader recreation', async ({
  page,
}, info) => {
  await page.clock.install()
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  await toggle.click()
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'private-attribution.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    {
      name: 'private-attribution.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  const open = async (name: string) => {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    const entry = page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name, exact: true })
    await entry.click()
    await expect(entry).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  }
  await open('PDF: private-attribution.pdf')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await open('EPUB: private-attribution.epub')
  const chapter = () =>
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter', exact: true })
  await expect(chapter()).toBeVisible()
  const pdf = page.getByRole('tab', { name: /PDF: private-attribution.pdf/ })
  const epub = page.getByRole('tab', { name: /EPUB: private-attribution.epub/ })
  await pdf.click()
  await epub.click()
  await expect(chapter()).toBeVisible()
  await pdf.click()
  await page.clock.fastForward(240000)
  await expect(page.locator('.epub-reader')).toHaveCount(1)
  await page.clock.fastForward(61000)
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await epub.click()
  await expect(chapter()).toBeVisible()
  await page.clock.resume()
  await toggle.click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const file = await download
  const json = await readFile((await file.path())!, 'utf8')
  const summary = JSON.parse(json)
  const timings = summary.resourceInvestigation.timings as { operation: string; outcome: string }[]
  for (const operation of [
    'pdf.cold-open',
    'epub.cold-open',
    'pdf.warm-activate',
    'epub.warm-activate',
    'epub.expired-open',
    'reading.restore',
  ]) {
    expect(
      timings.some((row) => row.operation === operation && row.outcome === 'completed'),
      operation,
    ).toBe(true)
  }
  expect(timings.filter((row) => row.operation === 'epub.expired-open')).toHaveLength(1)
  expect(json).not.toMatch(/private-attribution|First chapter|reader-session-/)
  await info.attach('reader-attribution-summary', { body: json, contentType: 'application/json' })
})

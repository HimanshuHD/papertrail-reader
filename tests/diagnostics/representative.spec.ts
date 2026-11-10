import { expect, test, type Page } from '@playwright/test'
import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import { createPdfFixture, createImagePdfFixture } from '../fixtures/pdf'
import { createFormattedEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

// Functional scale evidence only. Real clocks; no accepted latency or overhead budget.
async function start(page: Page) {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.getByRole('button', { name: 'Developer diagnostics', exact: true }).click()
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
}
async function open(page: Page, label: string) {
  const entry = page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name: label, exact: true })
  await entry.click()
  await expect(entry).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
}
async function privateExport(page: Page) {
  await page.getByRole('button', { name: 'Developer diagnostics', exact: true }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const file = await pending
  const text = await readFile((await file.path())!, 'utf8')
  expect(text).not.toMatch(/scale-private|Formatted chapter|Reading paragraph|Author formatting/)
  const data = JSON.parse(text)
  expect(data.identity.sourceSha).toBe(process.env.DIAGNOSTIC_EXPECTED_SHA)
  expect(data.running).toBe(true)
}
for (const files of [100, 1000]) {
  test(`representative ${files}-file input library remains searchable and readable`, async ({
    page,
    browserName,
  }, info) => {
    await start(page)
    const buffer = createPdfFixture(2)
    const started = performance.now()
    await page.locator('input[accept*=".pdf"]').setInputFiles(
      Array.from({ length: files }, (_, index) => ({
        name: `scale-private-${String(index).padStart(4, '0')}.pdf`,
        mimeType: 'application/pdf',
        buffer,
      })),
    )
    const library = page.getByRole('region', { name: 'Library documents', exact: true })
    await expect(library).toHaveAttribute('aria-busy', 'false')
    await expect(library.getByRole('button', { name: /^PDF: scale-private-/ })).toHaveCount(files)
    const listingMs = performance.now() - started
    const last = `scale-private-${String(files - 1).padStart(4, '0')}.pdf`
    await page.getByRole('searchbox', { name: 'Search library', exact: true }).fill(last)
    await expect(library.getByRole('button', { name: /^PDF: scale-private-/ })).toHaveCount(1)
    await open(page, `PDF: ${last}`)
    await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
    await page.getByRole('button', { name: `Close ${last}`, exact: true }).click()
    await expect(page.locator('.pdf-reader')).toHaveCount(0)
    await privateExport(page)
    await info.attach('representative-functional-evidence', {
      body: JSON.stringify({
        engine: browserName,
        scenario: `library-${files}`,
        files,
        pdfPages: 2,
        paragraphs: 0,
        fixtureBytes: buffer.length * files,
        listingMs,
        elapsedMs: performance.now() - started,
      }),
      contentType: 'application/json',
    })
  })
}

test('representative 1001-page PDF supports distant navigation and zoom', async ({
  page,
  browserName,
}, info) => {
  await start(page)
  const buffer = createPdfFixture(1001)
  const started = performance.now()
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles({ name: 'scale-private.pdf', mimeType: 'application/pdf', buffer })
  await open(page, 'PDF: scale-private.pdf')
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  const input = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  await expect(input).toHaveAttribute('max', '1001')
  await input.fill('1001')
  await input.press('Tab')
  await expect(page.locator('[data-pdf-page="1001"]')).toHaveAttribute('data-render-state', 'ready')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('[data-pdf-page="1001"]')).toHaveAttribute('data-render-state', 'ready')
  await input.fill('1')
  await input.press('Tab')
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  await page.getByRole('button', { name: 'Close scale-private.pdf', exact: true }).click()
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  await privateExport(page)
  await info.attach('representative-functional-evidence', {
    body: JSON.stringify({
      engine: browserName,
      scenario: 'pdf-1001',
      files: 1,
      pdfPages: 1001,
      paragraphs: 0,
      fixtureBytes: buffer.length,
      elapsedMs: performance.now() - started,
    }),
    contentType: 'application/json',
  })
})

test('representative long styled EPUB remains readable through reflow and chapter navigation', async ({
  page,
  browserName,
}, info) => {
  await start(page)
  const buffer = Buffer.from(createFormattedEpubFixture(1000))
  const started = performance.now()
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles({ name: 'scale-private.epub', mimeType: 'application/epub+zip', buffer })
  await open(page, 'EPUB: scale-private.epub')
  const reader = page.locator('.epub-reader:visible')
  const frame = reader.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'Formatted chapter', exact: true })).toBeVisible()
  await expect(frame.getByRole('img', { name: 'Local illustration', exact: true })).toBeVisible()
  await expect(frame.getByText('Author formatting.', { exact: true })).toHaveCSS(
    'letter-spacing',
    '1px',
  )
  const end = frame.getByText('Reading paragraph 999. Local text flows across the reader.', {
    exact: true,
  })
  await end.scrollIntoViewIfNeeded()
  await expect(end).toBeVisible()
  await reader.getByRole('button', { name: 'Typography', exact: true }).click()
  await reader.getByRole('button', { name: 'Increase font size', exact: true }).click()
  await reader.getByRole('button', { name: 'Close typography', exact: true }).click()
  await end.scrollIntoViewIfNeeded()
  await expect(end).toBeVisible()
  await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(frame.getByRole('heading', { name: 'Second chapter', exact: true })).toBeVisible()
  await reader.getByRole('button', { name: 'Previous chapter', exact: true }).click()
  await expect(frame.getByRole('heading', { name: 'Formatted chapter', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close scale-private.epub', exact: true }).click()
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await privateExport(page)
  await info.attach('representative-functional-evidence', {
    body: JSON.stringify({
      engine: browserName,
      scenario: 'epub-long',
      files: 1,
      pdfPages: 0,
      paragraphs: 1000,
      fixtureBytes: buffer.length,
      elapsedMs: performance.now() - started,
    }),
    contentType: 'application/json',
  })
})

test('representative image-heavy PDF decodes distinct rasters through navigation and zoom', async ({
  page,
  browserName,
}, info) => {
  await start(page)
  const buffer = createImagePdfFixture()
  expect(buffer.length).toBeGreaterThan(9_000_000)
  const started = performance.now()
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles({ name: 'scale-private-image.pdf', mimeType: 'application/pdf', buffer })
  await open(page, 'PDF: scale-private-image.pdf')
  const input = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  const raster = async (number: number) => {
    const view = page.locator(`[data-pdf-page="${number}"]`)
    await expect(view).toHaveAttribute('data-render-state', 'ready')
    // A ready blank canvas is insufficient: inspect the painted image center.
    const color = await view.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixel = canvas
        .getContext('2d')!
        .getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
      return Array.from(pixel)
    })
    expect(color[3]).toBe(255)
    expect(color.slice(0, 3).some((value) => value < 240)).toBe(true)
    return color
  }
  const first = await raster(1)
  await input.fill('12')
  await input.press('Tab')
  const last = await raster(12)
  expect(last).not.toEqual(first)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await raster(12)
  await input.fill('1')
  await input.press('Tab')
  await raster(1)
  await page.getByRole('button', { name: 'Close scale-private-image.pdf', exact: true }).click()
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  await privateExport(page)
  await info.attach('representative-functional-evidence', {
    body: JSON.stringify({
      engine: browserName,
      scenario: 'pdf-images',
      files: 1,
      pdfPages: 12,
      paragraphs: 0,
      fixtureBytes: buffer.length,
      elapsedMs: performance.now() - started,
    }),
    contentType: 'application/json',
  })
})

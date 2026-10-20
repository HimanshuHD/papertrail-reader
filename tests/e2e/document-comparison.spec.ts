/// <reference types="vite/client" />
import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { settleReaderLayout, waitForWorkspaceReady } from '../fixtures/browser'
import { environmentDatabaseName } from '../../src/services/environment-storage'
import type { WorkspaceSnapshot } from '../../src/services/workspace-storage'
const files = [
  { name: 'left.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3, undefined, true) },
  { name: 'right.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(4, undefined, true) },
  { name: 'book.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(createEpubFixture()) },
  {
    name: 'other.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(
      createEpubFixture({
        chapter:
          '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p>Distinct comparison book.</p></body></html>',
      }),
    ),
  },
  { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
]
async function start(page: Page) {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles(files)
}
async function open(page: Page, label: string) {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
  await page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name: label, exact: true })
    .click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await settleReaderLayout(page.locator('.reader-layout'))
}
async function compare(page: Page, title: string) {
  await page.getByRole('button', { name: 'Compare documents', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Choose a document to compare' })
    .getByRole('button', { name: `Compare with ${title}`, exact: true })
    .click()
  await expect(page.getByRole('group', { name: 'Comparison controls' })).toBeVisible()
}
const pane = (page: Page, name: string) =>
  page.getByRole('region', { name: `${name} comparison pane`, exact: true })
const choose = (page: Page, side: 'left' | 'right') =>
  page.getByRole('button', { name: new RegExp(`^(Focus|Show) ${side} comparison document:`) })
async function readyPdf(page: Page) {
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}
async function uniqueIds(page: Page) {
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
      return ids.filter((id, index) => ids.indexOf(id) !== index)
    }),
  ).toEqual([])
}
async function stored(page: Page) {
  return page.evaluate(
    async (name) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<WorkspaceSnapshot | undefined>((resolve, reject) => {
          const request = db.transaction('workspace').objectStore('workspace').get('current')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      } finally {
        db.close()
      }
    },
    environmentDatabaseName('papertrail-workspace', new URL(page.url()).pathname),
  )
}

test('comparison preserves mixed reader state, iframe focus, drawer bounds, swap, exit and reload', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await start(page)
  await open(page, 'PDF: left.pdf')
  await readyPdf(page)
  const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  await field.fill('2')
  await field.press('Tab')
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await compare(page, 'left.pdf')
  const wide = await page
    .locator('.session-readers')
    .evaluate((el) => el.classList.contains('comparison-wide'))
  expect(wide).toBe(page.viewportSize()!.width >= 960)
  await expect(page.locator('.session-panel:not(.session-inactive)')).toHaveCount(wide ? 2 : 1)
  await choose(page, 'right').click()
  await expect(
    pane(page, 'left.pdf').getByRole('spinbutton', { name: 'Current page', exact: true }),
  ).toHaveValue('2')
  await pane(page, 'left.pdf').press('PageDown')
  await expect(
    pane(page, 'left.pdf').getByRole('spinbutton', { name: 'Current page', exact: true }),
  ).toHaveValue('3')
  await pane(page, 'left.pdf').getByRole('button', { name: 'Annotations', exact: true }).click()
  const drawer = pane(page, 'left.pdf').getByRole('complementary', {
    name: 'PDF annotations panel',
  })
  await expect(
    drawer.getByRole('button', { name: 'Export annotations (JSON)', exact: true }),
  ).toBeDisabled()
  await settleReaderLayout(pane(page, 'left.pdf'))
  const d = (await drawer.boundingBox())!,
    p = (await pane(page, 'left.pdf').boundingBox())!
  expect(d.x).toBeGreaterThanOrEqual(p.x - 1)
  expect(d.x + d.width).toBeLessThanOrEqual(p.x + p.width + 1)
  await drawer.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await choose(page, 'left').click()
  await pane(page, 'book.epub')
    .frameLocator('iframe')
    .getByRole('heading', { name: 'Second chapter' })
    .click()
  await expect(page.getByRole('tab', { selected: true })).toContainText('book.epub')
  await page
    .locator('.epub-reader:visible iframe')
    .evaluate((el) => Reflect.set(window, 'comparisonEpub', el))
  await page.getByRole('button', { name: 'Swap comparison panes', exact: true }).click()
  await expect(choose(page, 'right')).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page
      .locator('.epub-reader:visible iframe')
      .evaluate((el) => el === Reflect.get(window, 'comparisonEpub')),
  ).toBe(true)
  await uniqueIds(page)
  await info.attach('comparison-light', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await info.attach('comparison-dark', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Exit comparison', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Comparison controls' })).toHaveCount(0)
  await expect(page.locator('.session-panel:not(.session-inactive)')).toHaveCount(1)
  await compare(page, 'left.pdf')
  await expect
    .poll(
      async () =>
        (await stored(page))?.tabs?.sessions.find((s) => s.document.name === 'left.pdf')?.state.pdf
          ?.page,
    )
    .toBe(3)
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('group', { name: 'Comparison controls' })).toHaveCount(0)
  await expect(page.locator('.session-panel:not(.session-inactive)')).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Reconnect local document', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('comparison retains visible readers, expires a hidden partner and isolates corrupt and closed tabs', async ({
  page,
}) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  await open(page, 'PDF: left.pdf')
  await readyPdf(page)
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await compare(page, 'left.pdf')
  await page.locator('.pdf-reader').evaluate((el) => Reflect.set(window, 'comparisonPdf', el))
  const wide = await page
    .locator('.session-readers')
    .evaluate((el) => el.classList.contains('comparison-wide'))
  if (wide) {
    await page.clock.fastForward(301000)
    expect(
      await page
        .locator('.pdf-reader')
        .evaluate((el) => el === Reflect.get(window, 'comparisonPdf')),
    ).toBe(true)
    await page.setViewportSize({ width: 375, height: 900 })
    await expect(page.locator('.comparison-wide')).toHaveCount(0)
  }
  await page.clock.fastForward(301000)
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  await choose(page, 'right').click()
  await readyPdf(page)
  expect(
    await page.locator('.pdf-reader').evaluate((el) => el === Reflect.get(window, 'comparisonPdf')),
  ).toBe(false)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.session-panel:not(.session-inactive)')).toHaveCount(2)
  await expect(
    pane(page, 'book.epub').frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await open(page, 'PDF: broken.pdf')
  await expect(pane(page, 'broken.pdf').getByRole('alert')).toBeVisible()
  await expect(
    pane(page, 'book.epub').frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await choose(page, 'left').click()
  await pane(page, 'book.epub').getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(
    pane(page, 'book.epub').frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /broken.pdf/ }).focus()
  await page.getByRole('tab', { name: /broken.pdf/ }).press('Delete')
  await expect(page.getByRole('group', { name: 'Comparison controls' })).toHaveCount(0)
  await expect(page.getByRole('tab', { selected: true })).toContainText('book.epub')
  while (await page.getByRole('tab').count()) {
    const selected = page.getByRole('tab', { selected: true })
    await selected.focus()
    await selected.press('Delete')
  }
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
  await expect(page.locator('.pdf-reader,.epub-reader')).toHaveCount(0)
})

test('same-format comparison keeps PDF shortcuts and EPUB iframe focus independent', async ({
  page,
}) => {
  await start(page)
  await open(page, 'PDF: left.pdf')
  await readyPdf(page)
  await open(page, 'PDF: right.pdf')
  await readyPdf(page)
  await compare(page, 'left.pdf')
  await choose(page, 'left').click()
  await pane(page, 'right.pdf').press('PageDown')
  await expect(
    pane(page, 'right.pdf').getByRole('spinbutton', { name: 'Current page', exact: true }),
  ).toHaveValue('2')
  await choose(page, 'right').click()
  await expect(
    pane(page, 'left.pdf').getByRole('spinbutton', { name: 'Current page', exact: true }),
  ).toHaveValue('1')
  await page.getByRole('button', { name: 'Exit comparison', exact: true }).click()
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await open(page, 'EPUB: other.epub')
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await compare(page, 'book.epub')
  await choose(page, 'left').click()
  await pane(page, 'other.epub').getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(
    pane(page, 'other.epub')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await choose(page, 'right').click()
  await expect(
    pane(page, 'book.epub').frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await uniqueIds(page)
})

test('comparison counts reading time only for the focused pane', async ({ page }) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  await open(page, 'PDF: left.pdf')
  await readyPdf(page)
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Local reading insights', exact: true }),
  ).toBeVisible()
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .frameLocator('.epub-reader:visible iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Local reading insights', exact: true }),
  ).toBeVisible()
  await compare(page, 'left.pdf')
  const pdfTime = page.locator('.pdf-reader [aria-label="Local reading insights"] .text-3xl')
  const epubTime = page.locator('.epub-reader [aria-label="Local reading insights"] .text-3xl')
  const beforePdf = await pdfTime.textContent(),
    beforeEpub = await epubTime.textContent()
  await page.clock.runFor(2100)
  expect(await pdfTime.textContent()).toBe(beforePdf)
  expect(await epubTime.textContent()).not.toBe(beforeEpub)
  await choose(page, 'right').click()
  const pausedEpub = await epubTime.textContent(),
    startedPdf = await pdfTime.textContent()
  await page.clock.runFor(2100)
  expect(await epubTime.textContent()).toBe(pausedEpub)
  expect(await pdfTime.textContent()).not.toBe(startedPdf)
})

test('comparison preserves document-owned notes through partial source reconnection', async ({
  page,
}) => {
  await start(page)
  await open(page, 'PDF: left.pdf')
  await readyPdf(page)
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  await page
    .locator('[data-pdf-page="1"] .textLayer span')
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      document.getSelection()!.removeAllRanges()
      document.getSelection()!.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await page.locator('[id$=pdf-selection-note]').fill('Only PDF comparison note')
  await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
  await open(page, 'EPUB: book.epub')
  const heading = page
    .frameLocator('.epub-reader:visible iframe')
    .getByRole('heading', { name: 'First chapter' })
  await expect(heading).toBeVisible()
  await heading.evaluate((element) => {
    const doc = element.ownerDocument,
      range = doc.createRange()
    range.selectNodeContents(element)
    doc.getSelection()!.removeAllRanges()
    doc.getSelection()!.addRange(range)
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await page.locator('[id$=epub-selection-note]').fill('Only EPUB comparison note')
  await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
  await compare(page, 'left.pdf')
  await choose(page, 'right').click()
  await pane(page, 'left.pdf').getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(pane(page, 'left.pdf').locator('[data-annotation-id]')).toHaveCount(1)
  await expect(pane(page, 'left.pdf').locator('[data-annotation-id]')).toContainText(
    'Only PDF comparison note',
  )
  await expect(pane(page, 'left.pdf')).not.toContainText('Only EPUB comparison note')
  await pane(page, 'left.pdf')
    .getByRole('button', { name: 'Close utility panel', exact: true })
    .click()
  await choose(page, 'left').click()
  await pane(page, 'book.epub').getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(pane(page, 'book.epub').locator('[data-annotation-id]')).toContainText(
    'Only EPUB comparison note',
  )
  await expect(pane(page, 'book.epub')).not.toContainText('Only PDF comparison note')
  await pane(page, 'book.epub')
    .getByRole('button', { name: 'Close utility panel', exact: true })
    .click()
  async function reselect(values: typeof files) {
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(values)
    await expect(
      page.getByRole('region', { name: 'Library documents', exact: true }),
    ).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await settleReaderLayout(page.locator('.reader-layout'))
  }
  await reselect([files[0]!])
  await expect(page.getByRole('group', { name: 'Comparison controls' })).toBeVisible()
  await choose(page, 'left').click()
  await expect(
    pane(page, 'book.epub').getByRole('button', { name: 'Reconnect local document', exact: true }),
  ).toBeVisible()
  await choose(page, 'right').click()
  await readyPdf(page)
  await reselect([files[0]!, files[2]!])
  await choose(page, 'left').click()
  await expect(
    pane(page, 'book.epub').frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await pane(page, 'book.epub').getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(pane(page, 'book.epub').locator('[data-annotation-id]')).toHaveCount(1)
  await expect(pane(page, 'book.epub').locator('[data-annotation-id]')).toContainText(
    'Only EPUB comparison note',
  )
})

import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady, settleReaderLayout } from '../fixtures/browser'

async function savedMode(page: Page, format: 'PDF' | 'EPUB') {
  return page.evaluate(async (format) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(
        (format === 'PDF' ? 'papertrail-reading' : 'papertrail-epub-reading') +
          (location.pathname.includes('/staging/') ? ':staging' : ''),
      )
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const records = await new Promise<
        {
          name: string
          twoPage?: boolean
          view?: { twoPage?: boolean }
          location?: { cfi?: string }
        }[]
      >((resolve, reject) => {
        const request = db.transaction('documents', 'readonly').objectStore('documents').getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const record = records.find((r) => r.name === `spread.${format.toLowerCase()}`)
      return {
        mode: (format === 'PDF' ? record?.view?.twoPage : record?.twoPage) === true,
        cfi: record?.location?.cfi,
      }
    } finally {
      db.close()
    }
  }, format)
}

test('PDF spreads, accessible tooltips and close controls preserve the compact utility layout', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles({ name: 'spread.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(5) })
  await page.getByRole('button', { name: 'PDF: spread.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const tab = page.getByRole('tab', { selected: true })
  await tab.hover()
  await expect(page.getByRole('tooltip')).toHaveCount(1)
  await expect(page.getByRole('tooltip')).toContainText('spread.pdf')
  expect(await tab.getAttribute('title')).toBeNull()
  const a = (await tab.boundingBox())!,
    b = (await page.getByRole('tooltip').boundingBox())!
  const viewportWidth = page.viewportSize()!.width
  const expectedLeft = Math.max(
    8,
    Math.min(a.x + a.width / 2 - b.width / 2, viewportWidth - b.width - 8),
  )
  expect(Math.abs(b.x - expectedLeft)).toBeLessThan(2)
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true })
  await zoomIn.focus()
  await expect(page.getByRole('tooltip')).toHaveText('Zoom in')
  await expect(page.getByRole('tooltip')).toHaveCount(1)
  const tooltipId = await page.getByRole('tooltip').getAttribute('id')
  await expect(zoomIn).toHaveAttribute('aria-describedby', tooltipId!)
  const tip = (await page.getByRole('tooltip').boundingBox())!,
    button = (await zoomIn.boundingBox())!
  expect(tip.y).toBeGreaterThanOrEqual(button.y + button.height)
  await zoomIn.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const nav = page.getByRole('group', { name: 'Page navigation', exact: true })
  const zoom = page.getByRole('group', { name: 'Zoom controls', exact: true })
  const gaps = await nav.evaluate((el) => {
    const [prev, input, next] = [...el.children].map((c) => c.getBoundingClientRect())
    return [input!.left - prev!.right, next!.left - input!.right]
  })
  const zoomGaps = await zoom.evaluate((el) => {
    const [prev, input, next] = [...el.children].map((c) => c.getBoundingClientRect())
    return [input!.left - prev!.right, next!.left - input!.right]
  })
  expect(gaps).toEqual(zoomGaps)
  const layout = page.getByRole('group', { name: 'Page layout', exact: true })
  await expect(layout.getByRole('button')).toHaveCount(3)
  const spread = layout.getByRole('button', { name: 'Two-page view', exact: true })
  await spread.click()
  await expect(spread).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await savedMode(page, 'PDF')).mode).toBe(true)
  await expect(page.locator('.pdf-pages-spread')).toHaveCount(1)
  await expect
    .poll(async () => {
      const boxes = await page.locator('.pdf-page-shell').evaluateAll((els) =>
        els.slice(0, 2).map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width }
        }),
      )
      return Math.abs(boxes[0]!.y - boxes[1]!.y) < 1 && boxes[1]!.x > boxes[0]!.x + boxes[0]!.width
    })
    .toBe(true)
  await expect(page.locator('.pdf-page-shell')).toHaveCount(5)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue('3')
  await spread.click()
  await expect(spread).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.pdf-pages-spread')).toHaveCount(0)
  await spread.click()
  await expect.poll(async () => (await savedMode(page, 'PDF')).mode).toBe(true)
  const close = page.getByRole('button', { name: 'Close spread.pdf', exact: true })
  await close.focus()
  await close.press('Enter')
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
  await page.getByRole('button', { name: 'Show library', exact: true }).click()
  await page.getByRole('button', { name: 'PDF: spread.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(spread).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('EPUB two-page mode paginates within a chapter and restores location when returning to scrolling', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body><h1>Long chapter</h1>${Array.from({ length: 80 }, (_, i) => `<p id="part-${i}">Paragraph ${i}. ${'A quiet space for reading across two pages. '.repeat(12)}</p>`).join('')}</body></html>`
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'spread.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  })
  await page.getByRole('button', { name: 'EPUB: spread.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader', exact: true })
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Long chapter' }),
  ).toBeVisible()
  const spread = reader.getByRole('button', { name: 'Two-page view', exact: true })
  await spread.click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(spread).toHaveAttribute('aria-pressed', 'true')
  const frame = reader.frameLocator('iframe')
  await expect
    .poll(() =>
      frame.locator('body').evaluate((el) => {
        const s = getComputedStyle(el)
        return Math.round(el.clientWidth / (parseFloat(s.columnWidth) + parseFloat(s.columnGap)))
      }),
    )
    .toBe(2)
  await expect.poll(async () => (await savedMode(page, 'EPUB')).mode).toBe(true)
  const oldCfi = (await savedMode(page, 'EPUB')).cfi
  const before = await reader.locator('.epub-container').evaluate((el) => el.scrollLeft)
  await reader.getByRole('button', { name: 'Next pages', exact: true }).click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(before)
  await expect(reader.locator('header')).toContainText('Chapter 1 of 2')
  await expect.poll(async () => (await savedMode(page, 'EPUB')).cfi).not.toBe(oldCfi)
  const after = await reader.locator('.epub-container').evaluate((el) => el.scrollLeft)
  await spread.click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(spread).toHaveAttribute('aria-pressed', 'false')
  await expect(frame.getByRole('heading', { name: 'Long chapter' })).toBeAttached()
  await expect
    .poll(() => frame.locator('body').evaluate((el) => getComputedStyle(el).columnWidth))
    .toBe('auto')
  expect(after).toBeGreaterThan(0)
  const scroll = await reader.locator('.epub-container').evaluate((el) => el.scrollTop)
  expect(scroll).toBeGreaterThan(0)
  await spread.click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  const back = await reader.locator('.epub-container').evaluate((el) => el.scrollLeft)
  expect(back).toBeGreaterThan(0)
  await expect.poll(async () => (await savedMode(page, 'EPUB')).mode).toBe(true)
  const close = page.getByRole('button', { name: 'Close spread.epub', exact: true })
  await close.focus()
  await close.press('Enter')
  await page.getByRole('button', { name: 'Show library', exact: true }).click()
  await page.getByRole('button', { name: 'EPUB: spread.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await expect(spread).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('EPUB spreads preserve bookmarks, notes, chapter boundaries and five-minute restoration', async ({
  page,
}) => {
  await page.clock.install()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body><h1>Long chapter</h1>${Array.from({ length: 30 }, (_, i) => `<p id="part-${i}">Paragraph ${i}. ${'A quiet space for reading across two pages. '.repeat(12)}</p>`).join('')}</body></html>`
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'spread.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ chapter })),
    },
    { name: 'other.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) },
  ])
  await page.getByRole('button', { name: 'EPUB: spread.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader', exact: true })
  const ready = () => expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await ready()
  await reader.getByRole('button', { name: 'Two-page view', exact: true }).click()
  await ready()
  await reader.frameLocator('iframe').locator('body').click()
  await page.keyboard.press('ArrowRight')
  await ready()
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0)
  await reader.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await reader.getByLabel('Bookmark name', { exact: true }).fill('Spread place')
  await reader.getByRole('button', { name: 'Save current place', exact: true }).click()
  await expect(
    reader.getByRole('button', { name: 'Go to bookmark Spread place', exact: true }),
  ).toBeVisible()
  await reader.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await reader.getByRole('button', { name: 'Contents', exact: true }).click()
  await reader
    .getByRole('navigation', { name: 'EPUB contents', exact: true })
    .getByRole('button', { name: 'Second chapter', exact: true })
    .click()
  await ready()
  await reader.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await expect(reader.locator('header')).toContainText('Chapter 2 of 2')
  await expect(reader.getByRole('button', { name: 'Next pages', exact: true })).toBeDisabled()
  await reader.getByRole('button', { name: 'Previous pages', exact: true }).click()
  await ready()
  await expect(reader.locator('header')).toContainText('Chapter 1 of 2')
  await reader.getByRole('button', { name: 'Next pages', exact: true }).click()
  await ready()
  await expect(reader.locator('header')).toContainText('Chapter 2 of 2')
  await reader.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await reader.getByRole('button', { name: 'Go to bookmark Spread place', exact: true }).click()
  await ready()
  await reader.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await expect(reader.locator('header')).toContainText('Chapter 1 of 2')
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0)
  await settleReaderLayout(reader)
  await expect
    .poll(() =>
      reader.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
        const host = frame.closest('.epub-host')!,
          body = frame.contentDocument!.body
        const style = frame.contentWindow!.getComputedStyle(body)
        return Math.abs(
          2 * (parseFloat(style.columnWidth) + parseFloat(style.columnGap)) - host.clientWidth,
        )
      }),
    )
    .toBeLessThan(3)
  await reader.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
    const body = frame.contentDocument!.body,
      bounds = frame.closest('.epub-container')!.getBoundingClientRect(),
      outer = frame.getBoundingClientRect()
    const p = Array.from(body.querySelectorAll('p')).find((p) => {
      const r = p.getClientRects()[0]!
      return (
        outer.left + r.left >= bounds.left &&
        outer.left + r.left < bounds.right &&
        outer.top + r.top >= bounds.top &&
        outer.top + r.top < bounds.bottom - 80
      )
    })!
    const doc = p.ownerDocument,
      range = doc.createRange()
    range.selectNodeContents(p)
    doc.getSelection()!.removeAllRanges()
    doc.getSelection()!.addRange(range)
    doc.dispatchEvent(new Event('selectionchange'))
    p.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await page.locator('[id$=epub-selection-note]').fill('Two-page note')
  await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
  await expect(page.locator('.toast-host')).toContainText('saved')
  const marker = reader.locator('.reader-note-indicator')
  await expect(marker).toBeVisible()
  const box = (await marker.boundingBox())!,
    host = (await reader.locator('.epub-host').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(host.x)
  expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width)
  await reader.evaluate((el) => Reflect.set(window, 'spreadReaderNode', el))
  await page.getByRole('button', { name: 'Show library', exact: true }).click()
  await page.getByRole('button', { name: 'PDF: other.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const tab = page.getByRole('tab', { name: /EPUB: spread.epub/ })
  await tab.click()
  expect(await reader.evaluate((el) => el === Reflect.get(window, 'spreadReaderNode'))).toBe(true)
  await expect(reader.getByRole('button', { name: 'Two-page view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('tab', { name: /PDF: other.pdf/ }).click()
  await page.clock.fastForward(300001)
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await tab.click()
  await ready()
  await expect(reader.getByRole('button', { name: 'Two-page view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0)
  await expect(reader.locator('.reader-note-indicator')).toBeVisible()
  expect(errors).toEqual([])
})

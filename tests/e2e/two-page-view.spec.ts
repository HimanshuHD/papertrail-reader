import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

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

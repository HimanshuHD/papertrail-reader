import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'

for (const rotation of [0, 90, 270]) {
  test(`PDF native cross-page drag keeps its anchor through gaps and re-entry at ${rotation} degrees`, async ({
    page,
  }, info) => {
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'drag.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(2, undefined, false, rotation),
    })
    await page.getByRole('button', { name: 'PDF: drag.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    // Minimum zoom mounts both pages simultaneously at every acceptance width.
    for (let i = 0; i < 5; i++)
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
    await expect(page.locator('#pdf-page-2')).toHaveAttribute('data-render-state', 'ready')
    const endpoints = async (number: number) =>
      page
        .locator(`#pdf-page-${number} .textLayer span`)
        .first()
        .evaluate((element, angle) => {
          const rect = element.getBoundingClientRect()
          const vertical = angle === 90 || angle === 270,
            reverse = angle === 270
          return {
            start: vertical
              ? { x: rect.x + rect.width / 2, y: reverse ? rect.bottom + 2 : rect.top - 2 }
              : { x: rect.left - 2, y: rect.y + rect.height / 2 },
            end: vertical
              ? { x: rect.x + rect.width / 2, y: reverse ? rect.top - 2 : rect.bottom + 2 }
              : { x: rect.right + 2, y: rect.y + rect.height / 2 },
          }
        }, rotation)
    const first = await endpoints(1),
      second = await endpoints(2)
    const one = (await page.locator('#pdf-page-1').boundingBox())!,
      two = (await page.locator('#pdf-page-2').boundingBox())!
    for (const backward of [false, true]) {
      const start = backward ? second.end : first.start,
        end = backward ? first.start : second.end
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(one.x + one.width / 2, (one.y + one.height + two.y) / 2, { steps: 6 })
      await page.mouse.move(Math.max(1, one.x - 5), first.start.y, { steps: 6 })
      await page.mouse.move(end.x, end.y, { steps: 8 })
      await page.mouse.up()
      await expect
        .poll(() =>
          page.evaluate(() => document.getSelection()?.toString().replace(/\s+/g, ' ').trim()),
        )
        .toBe('First page Second page')
      await expect(page.getByRole('button', { name: 'Add highlight', exact: true })).toBeVisible()
    }
    // Cancellation must release the guard before another independent selection.
    await page.mouse.move(first.start.x, first.start.y)
    await page.mouse.down()
    await page.mouse.move(first.end.x, first.end.y, { steps: 5 })
    await page.evaluate(() =>
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })),
    )
    await page.mouse.up()
    await page.mouse.move(second.start.x, second.start.y)
    await page.mouse.down()
    await page.mouse.move(second.end.x, second.end.y, { steps: 5 })
    await page.mouse.up()
    await expect
      .poll(() => page.evaluate(() => document.getSelection()?.toString().trim()))
      .toBe('Second page')
    await page.screenshot({ path: info.outputPath(`pdf-native-drag-${rotation}.png`) })
  })
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} checkpoint quota failure retains the session and retry commits once`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put
      let blocked = false
      IDBObjectStore.prototype.put = function (...args) {
        if (blocked && this.transaction.db.name === 'papertrail-statistics')
          throw new DOMException('Injected checkpoint quota failure', 'QuotaExceededError')
        return put.apply(this, args)
      }
      Reflect.set(window, 'blockCheckpoints', (value: boolean) => {
        blocked = value
      })
    })
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: `quota.${format.toLowerCase()}`,
      mimeType: format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
      buffer: format === 'PDF' ? createPdfFixture(1) : Buffer.from(createEpubFixture()),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: new RegExp('quota\\.') })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(
      insights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeEnabled()
    await page.clock.install()
    await page.evaluate(() => {
      Reflect.set(document, 'hasFocus', () => true)
      document.dispatchEvent(new Event('reader-activity', { bubbles: true }))
    })
    await page.clock.runFor(2000)
    await page.evaluate(() => {
      ;(Reflect.get(window, 'blockCheckpoints') as (value: boolean) => void)(true)
      window.dispatchEvent(new Event('blur'))
    })
    await expect(insights.getByRole('alert')).toContainText('Reading insights could not be saved')
    await page.evaluate(() =>
      (Reflect.get(window, 'blockCheckpoints') as (value: boolean) => void)(false),
    )
    await insights.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(insights.getByRole('alert')).toHaveCount(0)
    const read = () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('papertrail-statistics')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        try {
          return await new Promise<{ activeMs: number; visits: number }>((resolve, reject) => {
            const request = db.transaction('documents').objectStore('documents').getAll()
            request.onsuccess = () =>
              resolve(request.result.find((record) => record.id.startsWith('statistics:')))
            request.onerror = () => reject(request.error)
          })
        } finally {
          db.close()
        }
      })
    const saved = await read()
    expect(saved.activeMs).toBeGreaterThanOrEqual(2000)
    expect(saved.visits).toBe(1)
    // A duplicate flush of the same cumulative session must not double-count it.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect.poll(read).toEqual(saved)
    if (format === 'PDF')
      await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
    else
      await expect(
        page.frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
      ).toBeVisible()
  })
}

test('PDF distant saved highlight lands 24px below the reading viewport after virtualization', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'distant.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(12),
  })
  await page.getByRole('button', { name: 'PDF: distant.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  await field.fill('8')
  await field.press('Tab')
  await expect(page.locator('#pdf-page-8')).toHaveAttribute('data-render-state', 'ready')
  await page
    .locator('#pdf-page-8 .textLayer span')
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      document.getSelection()!.removeAllRanges()
      document.getSelection()!.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
  await page.getByRole('button', { name: 'Add highlight', exact: true }).click()
  await field.fill('1')
  await field.press('Tab')
  await expect(page.locator('#pdf-page-8')).toHaveAttribute('data-render-state', 'pending')
  await page.getByRole('button', { name: 'Annotations', exact: true }).click()
  await page.locator('[data-annotation-id]').first().click()
  await expect(page.locator('#pdf-page-8')).toHaveAttribute('data-render-state', 'ready')
  await expect
    .poll(() =>
      page.locator('.pdf-scroll').evaluate((pane) => {
        const text = pane.querySelector('#pdf-page-8 .textLayer span')!
        return Math.round(
          text.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientTop,
        )
      }),
    )
    .toBe(24)
})

test('EPUB distant saved highlight lands at the same top offset in both rendering modes', async ({
  page,
}) => {
  const paragraphs = Array.from(
    { length: 70 },
    (_, i) => `<p id="p${i}">Paragraph ${i}. Local reading content wraps across the document.</p>`,
  ).join('')
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'distant.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(
      createEpubFixture({
        chapter: `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body>${paragraphs}</body></html>`,
      }),
    ),
  })
  await page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name: /distant.epub/ })
    .click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const target = page.frameLocator('iframe').locator('#p40')
  await target.scrollIntoViewIfNeeded()
  await target.evaluate((element) => {
    const doc = element.ownerDocument,
      range = doc.createRange()
    range.selectNodeContents(element)
    doc.getSelection()!.removeAllRanges()
    doc.getSelection()!.addRange(range)
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Add highlight', exact: true }).click()
  for (const textOnly of [false, true]) {
    if (textOnly) await page.getByRole('switch', { name: 'Text-only view' }).click()
    await page.locator('.epub-container').evaluate((element) => {
      element.scrollTop = 0
    })
    await page.getByRole('button', { name: 'Annotations', exact: true }).click()
    await page.locator('[data-annotation-id]').first().click()
    await expect
      .poll(() =>
        page.locator('.epub-container').evaluate((pane) => {
          const frame = pane.querySelector('iframe')!,
            paragraph = frame.contentDocument!.querySelector('#p40')!
          const range = frame.contentDocument!.createRange()
          range.selectNodeContents(paragraph)
          const top = Math.min(
            ...[...range.getClientRects()]
              .filter((rect) => rect.width && rect.height)
              .map((rect) => rect.top),
          )
          return Math.round(
            frame.getBoundingClientRect().top +
              frame.clientTop +
              top -
              pane.getBoundingClientRect().top -
              pane.clientTop,
          )
        }),
      )
      .toBe(24)
    await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  }
})

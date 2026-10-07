import { openAnnotationActions } from '../fixtures/browser'
import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} delayed annotation metadata shows loading until native data is delivered`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB)
      let release: (() => void) | undefined
      indexedDB.open = ((name: string, version?: number) => {
        const request = version === undefined ? open(name) : open(name, version)
        if (name === 'papertrail-annotations') {
          let delivered = false
          request.addEventListener('success', (event) => {
            if (delivered) return
            event.stopImmediatePropagation()
            release = () => {
              delivered = true
              request.dispatchEvent(new Event('success'))
            }
          })
        }
        return request
      }) as typeof indexedDB.open
      Reflect.set(window, 'deliverMetadata', () => release?.())
    })
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: `loading.${format.toLowerCase()}`,
      mimeType: format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
      buffer: format === 'PDF' ? createPdfFixture(1) : Buffer.from(createEpubFixture()),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: /loading\./ })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(insights).toContainText('Loading annotations…')
    await expect(insights.getByTestId('highlight-count')).toHaveCount(0)
    await expect(insights.getByTestId('note-count')).toHaveCount(0)
    await page.evaluate(() => (Reflect.get(window, 'deliverMetadata') as () => void)())
    await expect(insights.getByTestId('highlight-count')).toHaveText('0')
    await expect(insights.getByTestId('note-count')).toHaveText('0')
  })
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} missing saved anchor remains unresolved without guessing a new reading position`, async ({
    page,
  }) => {
    const file = {
      name: `anchor.${format.toLowerCase()}`,
      mimeType: format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
      buffer: format === 'PDF' ? createPdfFixture(1) : Buffer.from(createEpubFixture()),
    }
    const open = async () => {
      const show = page.getByRole('button', { name: 'Show library', exact: true })
      if (await show.isVisible()) await show.click()
      await page.locator('input[accept*=".pdf"]').setInputFiles(file)
      if (await show.isVisible()) await show.click()
      await page
        .getByRole('region', { name: 'Library documents', exact: true })
        .getByRole('button', { name: /anchor\./ })
        .click()
      await page.getByRole('button', { name: 'Hide library' }).click()
    }
    await page.goto('./#/app')
    await open()
    const text =
      format === 'PDF'
        ? page.locator('#pdf-page-1 .textLayer span').first()
        : page.frameLocator('iframe').locator('p').first()
    await expect(text).toBeVisible()
    if (format === 'EPUB')
      await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    await text.evaluate((element) => {
      const doc = element.ownerDocument,
        range = doc.createRange()
      range.selectNodeContents(element)
      doc.getSelection()!.removeAllRanges()
      doc.getSelection()!.addRange(range)
      doc.dispatchEvent(new Event('selectionchange'))
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Add highlight', exact: true }).click()
    await expect(page.locator('.toast-host')).toContainText('Highlight saved.')
    await page.goto('./#/')
    await page.evaluate(async (kind) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('papertrail-annotations')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('documents', 'readwrite'),
            store = tx.objectStore('documents'),
            request = store.getAll()
          request.onsuccess = () => {
            const record = request.result.find((record) => record.format === kind)
            if (kind === 'PDF') record.annotations[0].selector.segments[0].page = 99
            else record.annotations[0].selector.chapter = 99
            store.put(record)
          }
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    }, format)
    await page.goto('./#/app')
    await open()
    const pane = page.locator(format === 'PDF' ? '.pdf-scroll' : '.epub-container')
    const before = await pane.evaluate((element) => element.scrollTop)
    await page.getByRole('button', { name: 'Annotations', exact: true }).click()
    await page.locator('[data-annotation-id]').first().click()
    await expect(page.locator('[data-annotation-id]')).toContainText('Unresolved')
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(before)
    await expect(page.locator('[data-annotation-id]')).toHaveCount(1)
  })
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} unavailable annotation metadata is not reported as zero and retry restores counts`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB)
      let blocked = true
      indexedDB.open = ((name: string, version?: number) => {
        if (blocked && name === 'papertrail-annotations')
          throw new DOMException('Injected unavailable metadata', 'SecurityError')
        return version === undefined ? open(name) : open(name, version)
      }) as typeof indexedDB.open
      Reflect.set(window, 'restoreMetadata', () => {
        blocked = false
      })
    })
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: `metadata.${format.toLowerCase()}`,
      mimeType: format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
      buffer: format === 'PDF' ? createPdfFixture(1) : Buffer.from(createEpubFixture()),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: /metadata\./ })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(insights).toContainText('Annotation counts unavailable.')
    await expect(insights.getByTestId('highlight-count')).toHaveCount(0)
    await expect(insights.getByTestId('note-count')).toHaveCount(0)
    await page.evaluate(() => (Reflect.get(window, 'restoreMetadata') as () => void)())
    await insights.getByRole('button', { name: 'See annotations', exact: true }).click()
    await page
      .getByRole('complementary', {
        name: format === 'PDF' ? 'PDF annotations panel' : 'EPUB utility panel',
      })
      .getByRole('button', { name: 'Retry annotations', exact: true })
      .click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    await expect(insights.getByTestId('highlight-count')).toHaveText('0')
    await expect(insights.getByTestId('note-count')).toHaveText('0')
  })
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} note draft stays unsaved and committed refresh failure retries without duplication`, async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB),
        put = IDBObjectStore.prototype.put
      let armed = false,
        blocked = false
      indexedDB.open = ((name: string, version?: number) => {
        if (blocked && name === 'papertrail-annotations')
          throw new DOMException('Injected post-commit refresh rejection', 'SecurityError')
        return version === undefined ? open(name) : open(name, version)
      }) as typeof indexedDB.open
      IDBObjectStore.prototype.put = function (...args) {
        const request = put.apply(this, args)
        if (armed && this.transaction.db.name === 'papertrail-annotations') {
          armed = false
          // The write already owns an open connection; reject subsequent refresh opens.
          blocked = true
        }
        return request
      }
      Reflect.set(window, 'armRefreshFailure', () => {
        armed = true
      })
      Reflect.set(window, 'restoreAnnotationStorage', () => {
        blocked = false
      })
    })
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: `draft.${format.toLowerCase()}`,
      mimeType: format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
      buffer: format === 'PDF' ? createPdfFixture(1) : Buffer.from(createEpubFixture()),
    })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: /draft\./ })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    await expect(page.getByTestId('highlight-count')).toHaveText('0')
    await expect(page.getByTestId('note-count')).toHaveText('0')
    await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
    const text =
      format === 'PDF'
        ? page.locator('#pdf-page-1 .textLayer span').first()
        : page.frameLocator('iframe').locator('p').first()
    await expect(page.locator('.utility-panel-leave-active')).toHaveCount(0)
    await page.evaluate(async () => {
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
    })
    if (format === 'PDF')
      await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
    await expect(text).toBeVisible()
    await text.scrollIntoViewIfNeeded()
    await page.evaluate(async () => {
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
    })
    if (format === 'EPUB')
      await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    await text.evaluate((element) => {
      const doc = element.ownerDocument,
        range = doc.createRange()
      range.selectNodeContents(element)
      doc.getSelection()!.removeAllRanges()
      doc.getSelection()!.addRange(range)
      doc.dispatchEvent(new Event('selectionchange'))
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Highlight blue', exact: true }).click()
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await page.locator(`#${format.toLowerCase()}-selection-note`).fill('Draft only')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Add highlight', exact: true })).toBeEnabled()
    expect(
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('papertrail-annotations')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        try {
          return await new Promise<number>((resolve, reject) => {
            const request = db.transaction('documents').objectStore('documents').getAll()
            request.onsuccess = () =>
              resolve(
                request.result.reduce((count, record) => count + record.annotations.length, 0),
              )
            request.onerror = () => reject(request.error)
          })
        } finally {
          db.close()
        }
      }),
    ).toBe(0)
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await page.locator(`#${format.toLowerCase()}-selection-note`).fill('Committed note')
    await page.evaluate(() => (Reflect.get(window, 'armRefreshFailure') as () => void)())
    await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
    await expect(
      page
        .getByText(
          'The change was saved, but annotations could not be refreshed. Retry annotations before editing again.',
          { exact: false },
        )
        .first(),
    ).toBeVisible()
    await page.evaluate(() => (Reflect.get(window, 'restoreAnnotationStorage') as () => void)())
    await page.getByRole('button', { name: 'Retry annotations', exact: true }).first().click()
    if (format === 'EPUB')
      await page.getByRole('region', { name: 'EPUB reader' }).click({ position: { x: 1, y: 1 } })
    await text.evaluate((element) => {
      const doc = element.ownerDocument
      doc.getSelection()?.removeAllRanges()
      doc.dispatchEvent(new Event('selectionchange'))
    })
    await expect(page.getByRole('group', { name: `${format} highlights` })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    await expect(page.getByTestId('highlight-count')).toHaveText('1')
    await expect(page.getByTestId('note-count')).toHaveText('1')
    await page.getByRole('button', { name: 'See annotations', exact: true }).click()
    await expect(page.locator('[data-annotation-id]')).toHaveCount(1)
    await expect(page.locator('[data-annotation-id]')).toContainText('Committed note')
    await expect(page.locator('[data-annotation-id]')).not.toContainText('Draft only')
    const entry = page.locator('[data-annotation-id]')
    await entry.click()
    await expect(entry).toHaveCSS('border-bottom-width', '0px')
    for (const dark of [false, true]) {
      if (dark) await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
      await openAnnotationActions(page.locator('[data-menu-id]').first())
      const popup = page.locator('.floating-popover')
      await expect(popup.getByRole('button', { name: 'Edit note', exact: true })).toBeVisible()
      const box = (await popup.boundingBox())!,
        viewport = page.viewportSize()!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
      await page.screenshot({
        path: info.outputPath(
          `${format.toLowerCase()}-annotation-actions-${dark ? 'dark' : 'light'}.png`,
        ),
      })
      await page.keyboard.press('Escape')
      await expect(popup).toHaveCount(0)
    }
  })
}

for (const rotation of [0, 90, 180, 270]) {
  for (const zoomSteps of [0, 1]) {
    test(`PDF native cross-page drag keeps its anchor through gaps and re-entry at ${rotation} degrees at ${25 + zoomSteps * 25}% zoom`, async ({
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
      // Keep the text on both pages in view while exercising two explicit zoom levels.
      for (let i = 0; i < 16; i++)
        await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
      if (zoomSteps) await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await expect(page.locator('#pdf-page-2')).toHaveAttribute('data-render-state', 'ready')
      await page.locator('#pdf-page-1 .textLayer span').first().scrollIntoViewIfNeeded()
      await page.locator('.pdf-scroll').evaluate((pane) => {
        const text = pane.querySelector('#pdf-page-1 .textLayer span')!
        pane.scrollTop += text.getBoundingClientRect().top - pane.getBoundingClientRect().top - 32
      })
      await expect(page.locator('#pdf-page-1 .textLayer span').first()).toBeInViewport()
      await expect(page.locator('#pdf-page-2 .textLayer span').first()).toBeInViewport()
      const endpoints = async (number: number) =>
        page
          .locator(`#pdf-page-${number} .textLayer span`)
          .first()
          .evaluate((element, angle) => {
            const rect = element.getBoundingClientRect()
            const vertical = angle === 90 || angle === 270,
              reverse = angle === 180 || angle === 270
            return {
              start: vertical
                ? { x: rect.x + rect.width / 2, y: reverse ? rect.bottom + 2 : rect.top - 2 }
                : { x: reverse ? rect.right + 2 : rect.left - 2, y: rect.y + rect.height / 2 },
              end: vertical
                ? { x: rect.x + rect.width / 2, y: reverse ? rect.top - 2 : rect.bottom + 2 }
                : { x: reverse ? rect.left - 2 : rect.right + 2, y: rect.y + rect.height / 2 },
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
    await page.clock.install()
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
    await page.evaluate(() => {
      Reflect.set(document, 'hasFocus', () => true)
      document.dispatchEvent(new Event('reader-activity', { bubbles: true }))
    })
    await page.clock.runFor(2000)
    await page.evaluate(() => {
      ;(Reflect.get(window, 'blockCheckpoints') as (value: boolean) => void)(true)
      Reflect.set(document, 'hasFocus', () => false)
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
              resolve(
                (({ activeMs, visits }) => ({ activeMs, visits }))(
                  request.result.find((record) => record.id.startsWith('statistics:')),
                ),
              )
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
        const range = document.createRange()
        range.selectNodeContents(text)
        return Math.round(
          range.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientTop,
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
  await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  await target.scrollIntoViewIfNeeded()
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
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

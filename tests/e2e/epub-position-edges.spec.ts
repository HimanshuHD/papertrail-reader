import { expect, test } from '@playwright/test'
import { createEpubFixture, createFormattedEpubFixture } from '../fixtures/epub'
import { settleReaderLayout, waitForWorkspaceReady } from '../fixtures/browser'
import { environmentDatabaseName } from '../../src/services/environment-storage'

for (const mode of ['formatted', 'text'] as const) {
  for (const scenario of ['image-only', 'chapter-end', 'rtl'] as const) {
    test(`EPUB ${scenario} position survives immediate close and reopening (${mode})`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const image = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="teal"/></svg>',
      )
      const fixture =
        scenario === 'chapter-end'
          ? createFormattedEpubFixture(180)
          : createEpubFixture({
              chapter:
                scenario === 'image-only'
                  ? '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Images</title></head><body>' +
                    Array.from(
                      { length: 80 },
                      (_, i) =>
                        `<p><img src="art.svg" alt="Illustration ${i}" width="300" height="300"/></p>`,
                    ).join('') +
                    '</body></html>'
                  : '<html xmlns="http://www.w3.org/1999/xhtml" dir="rtl"><head><title>RTL</title></head><body dir="rtl">' +
                    Array.from(
                      { length: 180 },
                      (_, i) => `<p>פסקה ${i} שלום עולם טקסט לקריאה ומיקום שמור.</p>`,
                    ).join('') +
                    '</body></html>',
              manifest: '<item id="art" href="art.svg" media-type="image/svg+xml"/>',
              files: { 'OPS/art.svg': image },
            })
      await page.goto('./#/app')
      await waitForWorkspaceReady(page)
      await page.locator('input[accept*=".pdf"]').setInputFiles({
        name: 'edge.epub',
        mimeType: 'application/epub+zip',
        buffer: Buffer.from(fixture),
      })
      const open = async () => {
        const show = page.getByRole('button', { name: 'Show library', exact: true })
        if (await show.isVisible()) await show.click()
        await page.getByRole('button', { name: 'EPUB: edge.epub', exact: true }).click()
        await page.getByRole('button', { name: 'Hide library', exact: true }).click()
        await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
        await settleReaderLayout(page.locator('.epub-reader'))
      }
      await open()
      if (mode === 'text') {
        await page.getByRole('switch', { name: 'Text-only view', exact: true }).click()
        await expect(page.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
        await settleReaderLayout(page.locator('.epub-reader'))
      }
      const pane = page.locator('.epub-container')
      expect(await pane.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100)
      await pane.evaluate((el, atEnd) => {
        el.dispatchEvent(new Event('wheel'))
        el.scrollTop = (el.scrollHeight - el.clientHeight) * (atEnd ? 1 : 0.6)
        el.dispatchEvent(new Event('scroll'))
        // Exercise final flushing before the scheduled capture frame runs.
        ;(
          document.querySelector('button[aria-label="Close edge.epub"]') as HTMLButtonElement
        ).click()
      }, scenario === 'chapter-end')
      await expect(page.locator('.epub-reader')).toHaveCount(0)
      const saved = () =>
        page.evaluate(
          async (name) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open(name)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            try {
              return await new Promise<
                { kind: string; node: string; atEnd: boolean; ratio: number } | undefined
              >((resolve, reject) => {
                const request = db.transaction('documents').objectStore('documents').getAll()
                request.onsuccess = () =>
                  resolve(request.result.find((record) => record.name === 'edge.epub')?.location)
                request.onerror = () => reject(request.error)
              })
            } finally {
              db.close()
            }
          },
          environmentDatabaseName('papertrail-epub-reading', new URL(page.url()).pathname),
        )
      await expect
        .poll(async () => (await saved())?.ratio)
        .toBeCloseTo(scenario === 'chapter-end' ? 1 : 0.6, 2)
      const location = (await saved())!
      if (scenario === 'chapter-end') expect(location.atEnd).toBe(true)
      if (scenario === 'image-only') expect(location.kind).toBe('element')
      await open()
      await expect
        .poll(() =>
          pane.evaluate((el) => el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)),
        )
        .toBeCloseTo(scenario === 'chapter-end' ? 1 : 0.6, 1)
      if (scenario !== 'chapter-end')
        await expect(
          page.frameLocator('iframe').locator(`[data-reader-node="${location.node}"]`),
        ).toBeInViewport()
      expect(errors).toEqual([])
    })
  }
}

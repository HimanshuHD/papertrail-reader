import { expect, test } from '@playwright/test'
import { createFormattedEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'
import { environmentDatabaseName } from '../../src/services/environment-storage'

for (const mode of ['native', 'position', 'geometry'] as const) {
  test(`EPUB scroll burst saves its final position before immediate close (${mode})`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'scroll.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createFormattedEpubFixture(1200)),
    })
    await page.getByRole('button', { name: 'EPUB: scroll.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(
      page.frameLocator('iframe').getByRole('heading', { name: 'Formatted chapter', exact: true }),
    ).toBeVisible()
    const synchronousWalks = await page.locator('.epub-container').evaluate((container, mode) => {
      const doc = container.querySelector('iframe')!.contentDocument!
      if (mode !== 'native')
        Object.defineProperty(doc, 'caretRangeFromPoint', { configurable: true, value: undefined })
      if (mode === 'geometry')
        Object.defineProperty(doc, 'caretPositionFromPoint', {
          configurable: true,
          value: undefined,
        })
      const original = doc.createTreeWalker.bind(doc)
      let walks = 0
      doc.createTreeWalker = (...args) => {
        ++walks
        return original(...args)
      }
      container.dispatchEvent(new Event('wheel'))
      container.scrollTop = (container.scrollHeight - container.clientHeight) * 0.6
      for (let index = 0; index < 50; index++) container.dispatchEvent(new Event('scroll'))
      const beforeClose = walks
      // Close in the same task, before the queued animation-frame capture can run.
      ;(
        document.querySelector('button[aria-label="Close scroll.epub"]') as HTMLButtonElement
      ).click()
      return beforeClose
    }, mode)
    expect(synchronousWalks).toBe(0)
    await expect(page.locator('.epub-reader')).toHaveCount(0)
    const saved = async () =>
      page.evaluate(
        async (name) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(name)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          try {
            return await new Promise<{ ratio: number; node: string } | undefined>(
              (resolve, reject) => {
                const request = db.transaction('documents').objectStore('documents').getAll()
                request.onsuccess = () =>
                  resolve(request.result.find((record) => record.name === 'scroll.epub')?.location)
                request.onerror = () => reject(request.error)
              },
            )
          } finally {
            db.close()
          }
        },
        environmentDatabaseName('papertrail-epub-reading', new URL(page.url()).pathname),
      )
    await expect.poll(async () => (await saved())?.ratio).toBeCloseTo(0.6, 2)
    const location = (await saved())!
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'EPUB: scroll.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(
      page.frameLocator('iframe').locator(`[data-reader-node="${location.node}"]`),
    ).toBeInViewport()
    await expect
      .poll(() =>
        page
          .locator('.epub-container')
          .evaluate(
            (element) =>
              element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight),
          ),
      )
      .toBeCloseTo(0.6, 1)
    expect(errors).toEqual([])
  })
}

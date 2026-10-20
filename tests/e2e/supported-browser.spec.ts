/// <reference types="vite/client" />
import { environmentDatabaseName } from '../../src/services/environment-storage'
import { waitForWorkspaceReady } from '../fixtures/browser'
import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createFormattedEpubFixture } from '../fixtures/epub'

test('local PDF and formatted EPUB remain readable through reselection and reload', async ({
  page,
  browser,
}, info) => {
  info.annotations.push({ type: 'browser-version', description: browser.version() })
  const requests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1')
      requests.push(request.url())
  })
  await page.goto('./#/app')
  const pdf = { name: 'support.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) }
  const epub = {
    name: 'support.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createFormattedEpubFixture()),
  }
  const open = async (file: typeof pdf) => {
    await waitForWorkspaceReady(page)
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page.locator('input[accept*=".pdf"]').setInputFiles([pdf, epub])
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: new RegExp(file.name) })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  }
  await open(pdf)
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.locator('[data-pdf-page="1"] .textLayer')).toContainText('First page')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const currentPage = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  await currentPage.fill('2')
  await currentPage.press('Tab')
  await expect(page.locator('[data-pdf-page="2"]')).toHaveAttribute('data-render-state', 'ready')
  await expect
    .poll(() =>
      page.evaluate(
        async (name) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(name)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          try {
            return await new Promise<number | undefined>((resolve, reject) => {
              const request = db.transaction('workspace').objectStore('workspace').get('current')
              request.onsuccess = () => resolve(request.result?.tabs?.sessions[0]?.state?.pdf?.page)
              request.onerror = () => reject(request.error)
            })
          } finally {
            db.close()
          }
        },
        environmentDatabaseName('papertrail-workspace', new URL(page.url()).pathname),
      ),
    )
    .toBe(2)
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Reconnect local document', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  await open(pdf)
  await expect(currentPage).toHaveValue('2')
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  await open(epub)
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'Formatted chapter' })).toBeVisible()
  await expect(frame.getByAltText('Local illustration')).toBeVisible()
  await page.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(frame.getByRole('heading', { name: 'Formatted chapter' })).toBeVisible()
  await page.setViewportSize({ width: 768, height: 900 })
  await expect
    .poll(() =>
      page
        .locator('.epub-container')
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'Local reading insights' })
      .getByRole('button', { name: 'Reset this document’s insights' }),
  ).toBeEnabled()
  await page.screenshot({ path: info.outputPath('supported-reader-dark.png') })
  await expect(page.getByRole('tab')).toHaveCount(2)
  await page.getByRole('tab', { name: /PDF: support.pdf/ }).click()
  await expect(currentPage).toHaveValue('2')
  await page.getByRole('tab', { name: /EPUB: support.epub/ }).click()
  await expect(page.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await page.setViewportSize(info.project.use.viewport ?? { width: 768, height: 900 })
  await page.getByRole('button', { name: 'Split view', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Choose a document for split view' })
    .getByRole('button', { name: 'Split with support.pdf', exact: true })
    .click()
  await page.getByRole('button', { name: /^(Focus|Show) right split view document:/ }).click()
  await expect(currentPage).toHaveValue('2')
  if ((info.project.use.viewport?.width ?? 768) < 960)
    await page.getByRole('button', { name: /^(Focus|Show) left split view document:/ }).click()
  await frame.getByRole('heading', { name: 'Formatted chapter' }).click()
  await expect(page.getByRole('tab', { selected: true })).toContainText('support.epub')
  await expect(page.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.screenshot({ path: info.outputPath('supported-comparison-dark.png') })
  await page.getByRole('button', { name: 'Exit split view', exact: true }).click()
  await expect(page.locator('.session-panel:not(.session-inactive)')).toHaveCount(1)
  expect(requests).toEqual([])
})

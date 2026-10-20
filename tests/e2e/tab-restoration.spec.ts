/// <reference types="vite/client" />
import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { libraryAction, waitForWorkspaceReady } from '../fixtures/browser'
import { environmentDatabaseName } from '../../src/services/environment-storage'
import type { WorkspaceSnapshot } from '../../src/services/workspace-storage'
async function stored(page: Page): Promise<WorkspaceSnapshot | undefined> {
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
async function showLibrary(page: Page) {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
}
async function open(page: Page, name: string) {
  await showLibrary(page)
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
}
const pdf = (name: string, pages: number) => ({
  name,
  mimeType: 'application/pdf',
  buffer: createPdfFixture(pages),
})
const book = {
  name: 'book.epub',
  mimeType: 'application/epub+zip',
  buffer: Buffer.from(createEpubFixture()),
}
async function readyPdf(page: Page) {
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

test('reload restores ordered mixed-format shells and verified reselect starts only the selected reader', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([pdf('first.pdf', 3), pdf('missing.pdf', 2), book])
  await open(page, 'PDF: first.pdf')
  await readyPdf(page)
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).press('Tab')
  await open(page, 'PDF: missing.pdf')
  await readyPdf(page)
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /PDF: first.pdf/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue('3')
  await expect
    .poll(async () => (await stored(page))?.tabs?.sessions.map((s) => s.document.name))
    .toEqual(['first.pdf', 'missing.pdf', 'book.epub'])
  // The lifecycle boundary captures the active state before continuity flushes it.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect.poll(async () => (await stored(page))?.tabs?.sessions[0]?.state.pdf?.page).toBe(3)
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('tab', { name: /PDF: first.pdf/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.pdf-reader, .epub-reader')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reconnect local document' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('saved-tabs-reconnect.png') })
  // Close during recovery; subsequent verification cannot resurrect this tab.
  await page.getByRole('tab', { name: /PDF: missing.pdf/ }).focus()
  await page.getByRole('tab', { name: /PDF: missing.pdf/ }).press('Delete')
  await page.getByRole('button', { name: 'Reconnect local document' }).click()
  await expect(page.getByRole('menuitem', { name: 'Choose PDF / EPUB files' })).toBeVisible()
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([pdf('renamed.pdf', 3), pdf('missing.pdf', 2), book])
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await readyPdf(page)
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /PDF: renamed.pdf/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue('3')
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await page.getByRole('tab', { name: /EPUB: book.epub/ }).click()
  await expect(
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await showLibrary(page)
  await (await libraryAction(page, 'Forget library')).click()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect.poll(() => stored(page)).toBeUndefined()
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('changed same-name content stays disconnected while a matching tab remains usable', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([pdf('first.pdf', 3), pdf('second.pdf', 2)])
  await open(page, 'PDF: first.pdf')
  await readyPdf(page)
  await open(page, 'PDF: second.pdf')
  await readyPdf(page)
  await page.getByRole('tab', { name: /PDF: first.pdf/ }).click()
  await showLibrary(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([pdf('first.pdf', 4), pdf('second.pdf', 2)])
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reconnect local document' })).toBeVisible()
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  await page.getByRole('tab', { name: /PDF: second.pdf/ }).click()
  await readyPdf(page)
  await expect(page.getByRole('tab')).toHaveCount(2)
  await open(page, 'PDF: first.pdf')
  await readyPdf(page)
  await expect(page.getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveAttribute(
    'max',
    '4',
  )
  await page.getByRole('tab', { selected: true }).press('Delete')
  await expect.poll(async () => (await stored(page))?.tabs?.sessions.length).toBe(2)
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(2)
})

test('Forget during a delayed reselect cannot resurrect saved tabs or library access', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles(pdf('book.pdf', 3))
  await open(page, 'PDF: book.pdf')
  await readyPdf(page)
  await showLibrary(page)
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return digest(...args)
    }
  })
  await page.locator('input[accept*=".pdf"]').setInputFiles(pdf('renamed.pdf', 3))
  await (await libraryAction(page, 'Forget library')).click()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect.poll(() => stored(page)).toBeUndefined()
  await page.reload()
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
})

test('legacy library selection without an active reader survives tab migration', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles(pdf('selected.pdf', 3))
  await open(page, 'PDF: selected.pdf')
  await readyPdf(page)
  await expect.poll(async () => (await stored(page))?.tabs?.sessions.length).toBe(1)
  await page.goto('./')
  const databaseName = environmentDatabaseName('papertrail-workspace', new URL(page.url()).pathname)
  await page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('workspace', 'readwrite')
        const store = transaction.objectStore('workspace')
        const get = store.get('current')
        get.onsuccess = () => {
          const value = get.result as WorkspaceSnapshot
          delete value.tabs
          value.activePath = null
          value.activeFingerprint = null
          value.selectedPath = 'selected.pdf'
          store.put(value, 'current')
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      db.close()
    }
  }, databaseName)
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await showLibrary(page)
  await expect(
    page.getByRole('button', { name: 'PDF: selected.pdf', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'PDF: selected.pdf', exact: true })).toBeDisabled()
  await expect.poll(async () => (await stored(page))?.selectedPath).toBe('selected.pdf')
})

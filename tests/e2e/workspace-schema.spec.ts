/// <reference types="vite/client" />
import { environmentDatabaseName } from '../../src/services/environment-storage'
import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { libraryAction, waitForWorkspaceReady } from '../fixtures/browser'

async function workspaceValue(page: Page) {
  return page.evaluate(
    async (databaseName) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<unknown>((resolve, reject) => {
          const request = database.transaction('workspace').objectStore('workspace').get('current')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      } finally {
        database.close()
      }
    },
    environmentDatabaseName('papertrail-workspace', new URL(page.url()).pathname),
  )
}

test('a newer workspace survives reading and writes until explicit Forget', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(
    async (databaseName) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1)
        request.onupgradeneeded = () => request.result.createObjectStore('workspace')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction('workspace', 'readwrite')
          transaction
            .objectStore('workspace')
            .put({ version: 2, marker: 'newer-schema-kept' }, 'current')
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
        })
      } finally {
        database.close()
      }
    },
    environmentDatabaseName('papertrail-workspace', new URL(page.url()).pathname),
  )
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await expect(page.getByText(/Saved workspace uses a newer format/)).toBeVisible()
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'readable.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  await page.getByRole('button', { name: 'PDF: readable.pdf', exact: true }).click()
  await expect(page.getByLabel('Rendered PDF page 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/Saved workspace uses a newer format/)).toBeVisible()
  expect(await workspaceValue(page)).toEqual({ version: 2, marker: 'newer-schema-kept' })
  await (await libraryAction(page, 'Forget library')).click()
  await expect.poll(() => workspaceValue(page)).toBeUndefined()
  await expect(page.getByRole('tab')).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('switching PDF→PDF→EPUB restores independent reading and utility state with one viewer', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'one.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(3, undefined, true),
    },
    {
      name: 'two.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(2),
    },
    {
      name: 'book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  const open = async (name: string) => {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page.getByRole('button', { name, exact: true }).click()
    if (page.viewportSize()!.width < 1024)
      await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  }
  const pdf = page.locator('.pdf-reader')
  const epub = page.getByRole('region', { name: 'EPUB reader' })
  await open('PDF: one.pdf')
  await expect(pdf.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  await pdf.getByRole('spinbutton', { name: 'Current page' }).fill('2')
  await pdf.getByRole('spinbutton', { name: 'Current page' }).press('Tab')
  await pdf.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await open('PDF: two.pdf')
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  await expect(pdf.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  await expect(pdf.getByRole('button', { name: 'Close utility panel' })).toHaveCount(0)
  await open('EPUB: book.epub')
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await epub.getByRole('button', { name: 'Next chapter' }).click()
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await open('PDF: one.pdf')
  await expect(pdf.locator('[aria-label="PDF pages"]')).toHaveAttribute('aria-busy', 'false')
  await expect(pdf.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('2')
  await expect(pdf.getByRole('button', { name: 'Close utility panel' })).toBeVisible()
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await open('EPUB: book.epub')
  await expect(
    epub.frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await expect(page.locator('.pdf-reader')).toHaveCount(0)
  expect(errors).toEqual([])
})

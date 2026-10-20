import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

async function showLibrary(page: Page) {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
}
async function open(page: Page, name: string) {
  await showLibrary(page)
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
}
const pdf = { name: 'good.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) }
const epub = {
  name: 'book.epub',
  mimeType: 'application/epub+zip',
  buffer: Buffer.from(createEpubFixture()),
}
const chapter = (page: Page) =>
  page
    .locator('.epub-reader:visible')
    .frameLocator('iframe')
    .getByRole('heading', { name: 'Second chapter' })

test('cancelled and denied source selection and a corrupt tab preserve warm mixed readers', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([
      pdf,
      epub,
      { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
    ])
  await open(page, 'PDF: good.pdf')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const currentPage = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  await currentPage.fill('2')
  await currentPage.press('Tab')
  await page
    .locator('.pdf-reader:visible')
    .evaluate((node) => Reflect.set(window, 'acceptancePdfNode', node))
  await open(page, 'EPUB: book.epub')
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await expect(chapter(page)).toBeVisible()
  await page
    .locator('.epub-reader:visible iframe')
    .evaluate((node) => Reflect.set(window, 'acceptanceEpubNode', node))
  await page.getByRole('tab', { name: /PDF: good.pdf/ }).click()
  for (const name of ['AbortError', 'NotAllowedError']) {
    await showLibrary(page)
    await page.evaluate(
      (name) =>
        Object.defineProperty(window, 'showDirectoryPicker', {
          configurable: true,
          value: async () => {
            throw new DOMException('Owner cancelled or denied', name)
          },
        }),
      name,
    )
    await page.getByRole('button', { name: /^(Add local documents|Library actions)$/ }).click()
    await page.getByRole('menuitem', { name: 'Choose folder', exact: true }).click()
    await expect(page.locator('#library-source-status')).toContainText(
      'cancelled or permission was not granted',
    )
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(page.getByRole('tab')).toHaveCount(2)
    await expect(currentPage).toHaveValue('2')
    expect(
      await page
        .locator('.pdf-reader:visible')
        .evaluate((node) => node === Reflect.get(window, 'acceptancePdfNode')),
    ).toBe(true)
  }
  await open(page, 'PDF: corrupt.pdf')
  await expect(page.getByRole('alert')).toContainText('PaperTrail could not open this PDF')
  await page.getByRole('tab', { name: /EPUB: book.epub/ }).click()
  await expect(chapter(page)).toBeVisible()
  expect(
    await page
      .locator('.epub-reader:visible iframe')
      .evaluate((node) => node === Reflect.get(window, 'acceptanceEpubNode')),
  ).toBe(true)
  await page.getByRole('button', { name: 'Close corrupt.pdf', exact: true }).click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(chapter(page)).toBeVisible()
  await page.getByRole('tab', { name: /PDF: good.pdf/ }).click()
  await expect(currentPage).toHaveValue('2')
  expect(errors).toEqual([])
})

test('closing the final tab cancels a pending identity check without resurrecting a reader', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([pdf, epub])
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
      await gate
      return digest(...args)
    }
    Reflect.set(window, 'releaseIdentity', () => {
      crypto.subtle.digest = digest
      release()
    })
  })
  await open(page, 'PDF: good.pdf')
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByRole('tab', { selected: true }).focus()
  await page.getByRole('tab', { selected: true }).press('Delete')
  await page.evaluate(() => (Reflect.get(window, 'releaseIdentity') as () => void)())
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.locator('.pdf-reader, .epub-reader')).toHaveCount(0)
  await open(page, 'PDF: good.pdf')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(page.getByRole('tab')).toHaveCount(1)
})

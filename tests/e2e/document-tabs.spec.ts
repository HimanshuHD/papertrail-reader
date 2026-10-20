import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { settleReaderLayout, waitForWorkspaceReady } from '../fixtures/browser'

async function openLibrary(page: Page) {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
}
async function open(page: Page, label: string) {
  await openLibrary(page)
  await page.getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await settleReaderLayout(page.locator('.reader-layout'))
}
const pdf = (name: string, pages: number) => ({
  name,
  mimeType: 'application/pdf',
  buffer: createPdfFixture(pages),
})

test('tabs preserve retained readers, manual keyboard activation, neighbor close and final empty library', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const reads: Record<string, number> = {}
    Reflect.set(window, 'tabIdentityReads', reads)
    const slice = File.prototype.slice
    File.prototype.slice = function (...args) {
      reads[this.name] = (reads[this.name] ?? 0) + 1
      return slice.apply(this, args)
    }
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    pdf('first.pdf', 3),
    pdf('second.pdf', 2),
    {
      name: 'book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  await open(page, 'PDF: first.pdf')
  const currentPage = page.getByRole('spinbutton', { name: 'Current page' })
  await expect(currentPage).toHaveValue('1')
  const originalReads = await page.evaluate(
    () => Reflect.get(window, 'tabIdentityReads')['first.pdf'] as number,
  )
  expect(originalReads).toBeGreaterThan(0)
  const selectedStyle = await page.getByRole('tab', { selected: true }).evaluate((element) => {
    const style = getComputedStyle(element)
    return { shadow: style.boxShadow, bottom: style.borderBottomWidth }
  })
  expect(selectedStyle).toEqual({ shadow: 'none', bottom: '0px' })
  await expect(page.getByRole('tab', { selected: true }).locator('button')).toHaveCount(0)
  await currentPage.fill('2')
  await currentPage.press('Tab')
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await page.getByLabel('Bookmark name', { exact: true }).fill('Only first document')
  await page.getByRole('button', { name: 'Save current place', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Go to bookmark Only first document', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Search PDF', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search PDF text', exact: true }).fill('First')
  await open(page, 'PDF: second.pdf')
  await expect(currentPage).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Close utility panel' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Go to bookmark Only first document', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Search PDF', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Search PDF text', exact: true })).toHaveValue(
    '',
  )
  await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await open(page, 'EPUB: book.epub')
  await expect(
    page
      .locator('.session-panel:not(.session-inactive)')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next chapter' }).click()
  await expect(
    page
      .locator('.session-panel:not(.session-inactive)')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveCount(3)
  const first = tabs.nth(0),
    second = tabs.nth(1),
    third = tabs.nth(2)
  await third.focus()
  await third.press('Home')
  await expect(first).toBeFocused()
  await expect(third).toHaveAttribute('aria-selected', 'true')
  await first.press('Enter')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(currentPage).toHaveValue('2')
  expect(
    await page.evaluate(() => Reflect.get(window, 'tabIdentityReads')['first.pdf'] as number),
  ).toBe(originalReads)
  await expect(page.getByRole('searchbox', { name: 'Search PDF text', exact: true })).toHaveValue(
    'First',
  )
  await expect(page.getByRole('button', { name: 'Close utility panel' })).toBeVisible()
  await expect(page.locator('.epub-reader:visible')).toHaveCount(0)
  await first.press('ArrowRight')
  await expect(second).toBeFocused()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await second.press('Space')
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await expect(currentPage).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Close utility panel' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close second.pdf', exact: true }).click()
  await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(/EPUB: book.epub/)
  await expect(
    page
      .locator('.session-panel:not(.session-inactive)')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'Second chapter' }),
  ).toBeVisible()
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  await page.getByRole('tab', { selected: true }).press('Delete')
  await expect(currentPage).toHaveValue('2')
  await page.getByRole('tab', { selected: true }).press('Delete')
  await expect(tabs).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show library', exact: true })).toBeFocused()
  await openLibrary(page)
  await expect(page.getByRole('button', { name: 'PDF: first.pdf', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'PDF: first.pdf', exact: true }).click()
  await expect(currentPage).toHaveValue('2')
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await page.getByRole('tab', { selected: true }).focus()
  await page.getByRole('tab', { selected: true }).press('Delete')
  await expect(page.getByRole('tab')).toHaveCount(0)
  await openLibrary(page)
  const add = page.getByRole('button', { name: /^(Add local documents|Library actions)$/ })
  await add.click()
  await expect(page.getByRole('menuitem', { name: 'Choose folder', exact: true })).toBeFocused()
  await expect(
    page.getByRole('menuitem', { name: 'Choose PDF / EPUB files', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('verified duplicates reuse tabs; overflow, errors and both themes stay usable at narrow widths', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const long = 'A very long document title that must truncate while remaining fully accessible.pdf'
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    pdf(long, 3),
    pdf('identical-content-alias.pdf', 3),
    pdf('other.pdf', 2),
    ...Array.from({ length: 4 }, (_, i) => pdf(`overflow-${i}.pdf`, i + 4)),
    {
      name: 'broken.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('invalid PDF document'),
    },
  ])
  await open(page, `PDF: ${long}`)
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  await open(page, 'PDF: identical-content-alias.pdf')
  await expect(page.getByRole('tab')).toHaveCount(1)
  await open(page, 'PDF: other.pdf')
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  for (let i = 0; i < 4; i++) await open(page, `PDF: overflow-${i}.pdf`)
  await open(page, 'PDF: broken.pdf')
  await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(/Unable to open/)
  await page.getByRole('button', { name: 'Open document list' }).click()
  await expect(page.getByRole('menuitemradio')).toHaveCount(7)
  await expect(page.getByRole('menuitemradio', { checked: true })).toContainText('broken.pdf')
  await page.getByRole('menuitemradio').first().click()
  await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(
    new RegExp('A very long document title'),
  )
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.getByRole('button', { name: 'Open document list' }).click()
  const menu = page.getByRole('menu', { name: 'Open documents', exact: true })
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await menu.press('Escape')
  await expect(page.getByRole('button', { name: 'Open document list' })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('annotations and notes remain owned by their document when tabs switch', async ({ page }) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles([pdf('annotated.pdf', 1), pdf('clean.pdf', 2)])
  await open(page, 'PDF: annotated.pdf')
  const text = page.locator('[data-pdf-page="1"] .textLayer span').first()
  await expect(text).toBeVisible()
  await text.evaluate((element) => {
    const doc = element.ownerDocument,
      range = doc.createRange()
    range.selectNodeContents(element)
    doc.getSelection()!.removeAllRanges()
    doc.getSelection()!.addRange(range)
    doc.dispatchEvent(new Event('selectionchange'))
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await page.locator('[id$=pdf-selection-note]').fill('Note only for the first document')
  await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
  await expect(page.locator('.toast-host')).toContainText('saved')
  await page.getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive) [data-annotation-id]'),
  ).toContainText('Note only for the first document')
  await open(page, 'PDF: clean.pdf')
  await page.getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive) [data-annotation-id]'),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive)').getByTestId('highlight-count'),
  ).toHaveText('0')
  await expect(
    page.locator('.session-panel:not(.session-inactive)').getByTestId('note-count'),
  ).toHaveText('0')
  await page.getByRole('tab', { name: /PDF: annotated.pdf/ }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive) [data-annotation-id]'),
  ).toContainText('Note only for the first document')
  await page.locator('.session-panel:not(.session-inactive) [data-menu-id]').first().click()
  await expect(page.locator('.floating-popover')).toBeVisible()
  const cleanTab = page.getByRole('tab', { name: /PDF: clean.pdf/ })
  await cleanTab.focus()
  await cleanTab.press('Enter')
  await expect(page.locator('.floating-popover')).toHaveCount(0)
  await page.getByRole('tab', { name: /PDF: annotated.pdf/ }).click()
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive)').getByTestId('highlight-count'),
  ).toHaveText('1')
  await expect(
    page.locator('.session-panel:not(.session-inactive)').getByTestId('note-count'),
  ).toHaveText('1')
})

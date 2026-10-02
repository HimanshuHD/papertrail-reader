import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await info.attach(name, { path, contentType: 'image/png' })
}

function createPdfFixture(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>',
  ]
  const streams = [
    'BT /F1 24 Tf 72 720 Td (First page) Tj ET',
    'BT /F1 24 Tf 72 720 Td (Second page) Tj ET',
  ]

  for (const stream of streams) {
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    )
  }

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'ascii')
}

test('home and app respond in both themes without overflow', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'The foundation is ready' })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: 'Dark mode' })
    if ((await toggle.getAttribute('aria-pressed')) !== String(theme === 'dark'))
      await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await noOverflow(page)
    await capture(page, info, `home-${theme}`)
    await page.getByRole('link', { name: 'Go to app' }).click()
    await expect(page).toHaveURL(/#\/app$/)
    await expect(page.locator('#reader-title')).toBeVisible()
    await noOverflow(page)
    const sidebar = await page.getByRole('complementary').boundingBox()
    const title = await page.locator('#reader-title').boundingBox()
    expect(sidebar).not.toBeNull()
    expect(title).not.toBeNull()
    expect(title!.width).toBeGreaterThan(200)
    if (page.viewportSize()!.width >= 1024)
      expect(title!.x).toBeGreaterThan(sidebar!.x + sidebar!.width)
    else {
      expect(sidebar!.height).toBeGreaterThan(0)
      expect(sidebar!.y + sidebar!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    }
    await capture(page, info, `app-${theme}`)
    await page.getByRole('link', { name: 'PaperTrail home' }).click()
  }
  expect(errors).toEqual([])
})

test('sample selection survives sidebar collapse; unavailable actions stay disabled', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.getByRole('button', { name: /The next chapter/ }).click()
  await expect(page.locator('#reader-title')).toHaveText('The next chapter')
  await expect(page.getByRole('button', { name: /Font size/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Contents' })).toBeDisabled()
  await page.getByRole('button', { name: 'Add local documents' }).click()
  await expect(page.getByRole('menuitem', { name: 'Choose folder' })).toBeEnabled()
  await expect(page.getByRole('menuitem', { name: 'Choose PDF / EPUB files' })).toBeEnabled()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await noOverflow(page)
  await page.getByRole('button', { name: 'Show library' }).click()
  await expect(page.locator('#reader-title')).toHaveText('The next chapter')
  await expect(page.getByRole('button', { name: /The next chapter/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await noOverflow(page)
})

test('keyboard entry, sidebar focus restoration, theme persistence and browser history work', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Go to app' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/app$/)

  const sample = page.getByRole('button', { name: /Welcome to PaperTrail/ })
  await sample.focus()
  await page.keyboard.press('Escape')
  const libraryToggle = page.getByRole('button', { name: 'Show library' })
  await expect(libraryToggle).toBeFocused()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary')).toBeVisible()

  const toggle = page.getByRole('button', { name: 'Dark mode' })
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'PaperTrail home' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/#\/app$/)
  await page.goForward()
  await expect(page.getByRole('link', { name: 'Go to app' })).toBeVisible()
})

test('browser library builds a tree, refreshes live handles and keeps file fallback flat', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let scan = 0
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        kind: 'directory',
        name: 'Mock library',
        async *entries() {
          scan += 1
          const version = scan

          yield [
            'guide.pdf',
            {
              kind: 'file',
              name: 'guide.pdf',
              getFile: async () =>
                new File([`pdf fixture ${version}`], 'guide.pdf', {
                  type: 'application/pdf',
                  lastModified: version,
                }),
            },
          ]

          yield [
            'Books',
            {
              kind: 'directory',
              name: 'Books',
              async *entries() {
                yield [
                  'book.epub',
                  {
                    kind: 'file',
                    name: 'book.epub',
                    getFile: async () =>
                      new File([`epub fixture ${version}`], 'book.epub', {
                        type: 'application/epub+zip',
                        lastModified: version,
                      }),
                  },
                ]
              },
            },
          ]
        },
      }),
    })
  })

  await page.goto('./#/app')
  const sourceStatus = page.locator('#library-source-status')
  const discoveryStatus = page.locator('#discovery-status')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await page.getByRole('button', { name: 'Add local documents' }).click()
  await page.getByRole('menuitem', { name: 'Choose folder' }).click()
  await expect(sourceStatus).toContainText('Folder “Mock library” selected')
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  await expect(localLibrary).toContainText('Mock library')
  await expect(
    localLibrary.locator('button[aria-expanded]').filter({ hasText: 'Books' }),
  ).toHaveAttribute('aria-expanded', 'true')

  let book = localLibrary.getByRole('button', { name: /book.epub/ })
  await book.click()
  await expect(book).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')

  await page.getByRole('button', { name: 'Refresh folder' }).click()
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  book = localLibrary.getByRole('button', { name: /book.epub/ })
  await expect(book).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })
  })
  await page.getByRole('button', { name: 'Add local documents' }).click()
  await page.getByRole('menuitem', { name: 'Choose folder' }).click()
  await expect(sourceStatus).toContainText('cancelled or permission was not granted')

  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'guide.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf fixture'),
    },
    {
      name: 'book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from('epub fixture'),
    },
  ])

  await expect(sourceStatus).toContainText('2 items selected from the file picker')
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  await expect(localLibrary).toContainText('Selected files')
  await expect(localLibrary.locator('button[aria-expanded]')).toHaveCount(0)
  await expect(localLibrary.getByRole('button', { name: /guide.pdf/ })).toBeVisible()
  await expect(localLibrary.getByRole('button', { name: /book.epub/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reselect files' })).toBeVisible()
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')
})

test('PDF reader renders local pages, text layer, navigation and malformed-file recovery', async ({
  page,
}) => {
  await page.goto('./#/app')
  const fileInput = page.locator('input[accept*=".pdf"]')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await fileInput.setInputFiles({
    name: 'reader.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  await expect(localLibrary.getByRole('button', { name: /reader\.pdf/ })).toBeVisible()
  await localLibrary.getByRole('button', { name: /reader\.pdf/ }).click()

  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.locator('#reader-title')).toHaveText('reader.pdf')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 1').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 1')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 1')).toContainText('First page')

  const nextPage = page.getByRole('button', { name: 'Next page' })
  await nextPage.hover()
  await expect(nextPage.locator('.icon-tooltip')).toBeVisible()
  await nextPage.focus()
  await expect(nextPage.locator('.icon-tooltip')).toBeVisible()
  await nextPage.click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 2').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 2')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 2')).toContainText('Second page')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByRole('button', { name: 'Show library' }).click()
  await fileInput.setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a valid PDF'),
  })
  await localLibrary.getByRole('button', { name: /broken\.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('alert')).toContainText('This file is not a valid or supported PDF.')
})

test('PDF search, keyboard utilities and fullscreen work on a real text PDF', async ({ page }) => {
  await page.goto('./#/app')
  const fileInput = page.locator('input[accept*=".pdf"]')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await fileInput.setInputFiles({
    name: 'searchable-document-name-that-is-much-longer-than-toolbar-space.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  const longName = 'searchable-document-name-that-is-much-longer-than-toolbar-space.pdf'
  await localLibrary.getByRole('button', { name: new RegExp(longName) }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const title = page.locator('#reader-title')
  await expect(title).toHaveText(longName)
  await expect(title).toHaveAttribute('title', longName)
  await expect(title).toHaveAttribute('aria-label', longName)
  await expect(title).toHaveCSS('text-overflow', 'ellipsis')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.keyboard.press('Control+f')
  const searchInput = page.getByRole('searchbox', { name: 'Search PDF text' })
  await expect(searchInput).toBeFocused()
  await searchInput.fill('Second')
  const searchPanel = page.locator('section[aria-labelledby="pdf-search-title"]')
  await searchPanel.getByRole('search').getByRole('button', { name: 'Search' }).click()
  await expect(searchPanel.getByRole('status')).toContainText('1 match across searchable text.')
  const resultsPanel = page.locator('[aria-label="PDF search results panel"]')
  await expect(searchPanel.getByRole('button', { name: /Page 2.*Second page/ })).toHaveCount(0)
  await expect(resultsPanel.getByRole('button', { name: /Page 2.*Second page/ })).toBeVisible()
  await resultsPanel.getByRole('button', { name: /Page 2.*Second page/ }).click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()

  await searchInput.focus()
  await page.keyboard.type('c')
  await expect(page.getByRole('heading', { name: 'PDF contents' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.keyboard.press('?')
  await expect(page.getByRole('heading', { name: 'Keyboard help' })).toBeVisible()
  await page.getByRole('button', { name: 'Close keyboard help' }).click()

  await page.keyboard.press('c')
  await expect(page.getByRole('heading', { name: 'PDF contents' })).toBeVisible()
  await expect(page.getByText('This PDF does not provide an outline.')).toBeVisible()
  await page.getByRole('button', { name: 'Close utility panel' }).click()

  await page.setViewportSize({ width: 375, height: 800 })
  await page.getByRole('button', { name: 'Contents' }).click()
  const narrowContents = page.locator('[aria-label="PDF contents panel"]')
  await expect(narrowContents).toBeVisible()
  await expect(narrowContents).toHaveCSS('position', 'absolute')
  await page.getByRole('button', { name: 'Close utility panel' }).click()

  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)
})

test('app bounds and library/PDF scrolling stay independent at short heights', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 500 })
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')
  await page.locator('input[accept*=".pdf"]').setInputFiles(
    Array.from({ length: 30 }, (_, i) => ({
      name: `document-${String(i).padStart(2, '0')}.pdf`,
      mimeType: 'application/pdf',
      buffer: createPdfFixture(),
    })),
  )
  await localLibrary.getByRole('button', { name: /document-00.pdf/ }).click()
  const pdf = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pdf).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollHeight <= window.innerHeight &&
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  const bounds = await pdf.boundingBox()
  expect(bounds!.height).toBeGreaterThan(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500)
  await library.focus()
  await page.keyboard.press('End')
  await expect
    .poll(() => library.evaluate((e) => Math.abs(e.scrollTop - (e.scrollHeight - e.clientHeight))))
    .toBeLessThanOrEqual(1)
  await expect.poll(() => library.evaluate((e) => e.scrollTop)).toBeGreaterThan(0)
  expect(await pdf.evaluate((e) => e.scrollTop)).toBe(0)
  const libraryPosition = await library.evaluate((e) => e.scrollTop)
  if (page.viewportSize()!.width < 1024) {
    await library.press('Escape')
    await expect(page.getByRole('button', { name: 'Show library' })).toBeFocused()
  }
  await expect(page.getByLabel('Rendered PDF page 1', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByLabel('Rendered PDF page 1', { exact: true })
        .evaluate((e) => (e as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0)
  await pdf.focus()
  await page.keyboard.press('PageDown')
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('2')
  await expect.poll(() => pdf.evaluate((e) => e.scrollTop)).toBeGreaterThan(0)
  if (page.viewportSize()!.width >= 1024)
    expect(await library.evaluate((e) => e.scrollTop)).toBe(libraryPosition)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('link', { name: 'PaperTrail home' }).click()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight))
    .toBe(true)
})

test('compact library menu dismisses independently and restores panel focus', async ({ page }) => {
  await page.goto('./#/app')
  const plus = page.getByRole('button', { name: 'Add local documents' })
  await expect(page.getByRole('button', { name: 'Show library' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh library' })).toBeDisabled()
  await plus.focus()
  await page.keyboard.press('Enter')
  const folder = page.getByRole('menuitem', { name: 'Choose folder' })
  await expect(folder).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Choose PDF / EPUB files' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(plus).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Document library' })).toBeVisible()
  await plus.click()
  await page.getByRole('link', { name: 'PaperTrail home' }).focus()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await plus.click()
  await page.locator('.app-header').click({ position: { x: 1, y: 1 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Hide library' }).click()
  const opener = page.getByRole('button', { name: 'Show library' })
  await expect(opener).toBeFocused()
  await opener.press('Enter')
  await expect(opener).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide library' })).toBeFocused()
  await noOverflow(page)
})

test('library width resizes within bounds and top opener preserves title space', async ({
  page,
}) => {
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const rail = page.getByRole('separator', { name: 'Resize library panel' })
  await expect
    .poll(async () => (await library.boundingBox())!.width)
    .toBe(Math.round(Math.min(308, page.viewportSize()!.width * 0.9)))
  await rail.hover()
  await expect(rail).toHaveCSS('cursor', 'col-resize')
  await rail.focus()
  await page.keyboard.press('ArrowLeft')
  const before = Number(await rail.getAttribute('aria-valuenow'))
  const bounds = (await rail.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + 80, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await rail.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
  await rail.focus()
  await page.keyboard.press('End')
  await expect
    .poll(async () => await rail.getAttribute('aria-valuenow'))
    .toBe(await rail.getAttribute('aria-valuemax'))
  await page.keyboard.press('Home')
  await expect
    .poll(async () => await rail.getAttribute('aria-valuenow'))
    .toBe(await rail.getAttribute('aria-valuemin'))
  await page.keyboard.press('ArrowRight')
  const remembered = await rail.getAttribute('aria-valuenow')
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(library).toHaveCount(0)
  const opener = page.getByRole('button', { name: 'Show library' })
  await expect(opener).toBeFocused()
  const openerBounds = (await opener.boundingBox())!
  const title = (await page.locator('#reader-title').boundingBox())!
  expect(openerBounds.y).toBeLessThanOrEqual(title.y)
  expect(openerBounds.x + openerBounds.width + 12).toBeLessThanOrEqual(title.x)
  await opener.click()
  await expect(rail).toHaveAttribute('aria-valuenow', remembered!)
  await noOverflow(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.reader-layout')).toHaveCSS('transition-duration', '0s')
})

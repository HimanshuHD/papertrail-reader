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
    else expect(title!.y).toBeGreaterThan(sidebar!.y + sidebar!.height)
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
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Choose PDF / EPUB files' })).toBeEnabled()
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
  const sourceStatus = page
    .locator('section[aria-labelledby="library-source-title"]')
    .getByRole('status')
  const discoveryStatus = page.locator('section[aria-labelledby="scan-title"]').getByRole('status')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await page.getByRole('button', { name: 'Choose folder' }).click()
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
  await page.getByRole('button', { name: 'Choose folder' }).click()
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

  await expect(page.locator('#reader-title')).toHaveText('reader.pdf')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 1').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 1')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 1')).toContainText('First page')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 2').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 2')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 2')).toContainText('Second page')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await fileInput.setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a valid PDF'),
  })
  await localLibrary.getByRole('button', { name: /broken\.pdf/ }).click()
  await expect(page.getByRole('alert')).toContainText('This file is not a valid or supported PDF.')
})

test('PDF search, keyboard utilities and fullscreen work on a real text PDF', async ({ page }) => {
  await page.goto('./#/app')
  const fileInput = page.locator('input[accept*=".pdf"]')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await fileInput.setInputFiles({
    name: 'searchable.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  await localLibrary.getByRole('button', { name: /searchable\.pdf/ }).click()
  await expect(page.locator('#reader-title')).toHaveText('searchable.pdf')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.keyboard.press('Control+f')
  const searchInput = page.getByRole('searchbox', { name: 'Search PDF text' })
  await expect(searchInput).toBeFocused()
  await searchInput.fill('Second')
  const searchPanel = page.locator('section[aria-labelledby="pdf-search-title"]')
  await searchPanel.getByRole('search').getByRole('button', { name: 'Search' }).click()
  await expect(searchPanel.getByRole('status')).toContainText('1 match across searchable text.')
  await expect(page.getByRole('button', { name: /Page 2.*Second page/ })).toBeVisible()
  await page.getByRole('button', { name: /Page 2.*Second page/ }).click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()

  await searchInput.focus()
  await page.keyboard.type('c')
  await expect(page.getByRole('heading', { name: 'Contents' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.keyboard.press('?')
  await expect(page.getByRole('heading', { name: 'Keyboard help' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.keyboard.press('c')
  await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible()
  await expect(page.getByText('This PDF does not provide an outline.')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)
})

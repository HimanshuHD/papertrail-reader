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
  await expect(localLibrary.getByRole('button', { name: /Books/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

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

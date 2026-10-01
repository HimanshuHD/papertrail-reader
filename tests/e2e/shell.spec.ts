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


test('browser source selection handles native success, cancellation and file input', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({ kind: 'directory', name: 'Mock library' }),
    })
  })

  await page.goto('./#/app')
  await page.getByRole('button', { name: 'Choose folder' }).click()
  await expect(page.getByText(/Folder “Mock library” selected/)).toBeVisible()

  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })
  })
  await page.getByRole('button', { name: 'Choose folder' }).click()
  await expect(page.getByText(/cancelled or permission was not granted/)).toBeVisible()

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
  await expect(page.getByText(/2 items selected from the file picker/)).toBeVisible()
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')
})

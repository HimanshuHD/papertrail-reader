import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('ready readers switch without remounting and restore only after five inactive minutes', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'first.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    { name: 'second.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) },
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
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  }
  await open('PDF: first.pdf')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).press('Tab')
  await page
    .locator('.pdf-reader:visible')
    .evaluate((el) => Reflect.set(window, 'retainedPdfNode', el))
  await open('PDF: second.pdf')
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await open('EPUB: book.epub')
  await expect(
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await page
    .locator('.epub-reader:visible iframe')
    .evaluate((el) => Reflect.set(window, 'retainedEpubNode', el))
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
      return ids.filter((id, index) => ids.indexOf(id) !== index)
    }),
  ).toEqual([])
  const first = page.getByRole('tab', { name: /PDF: first.pdf/ })
  const second = page.getByRole('tab', { name: /PDF: second.pdf/ })
  const book = page.getByRole('tab', { name: /EPUB: book.epub/ })
  for (let i = 0; i < 5; i++) {
    await first.click()
    expect(
      await page
        .locator('.pdf-reader:visible')
        .evaluate((el) => el === Reflect.get(window, 'retainedPdfNode')),
    ).toBe(true)
    await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue(
      '2',
    )
    await expect(page.locator('.session-panel:not(.session-inactive) .loading-card')).toHaveCount(0)
    await second.click()
    await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue(
      '1',
    )
    await book.click()
    expect(
      await page
        .locator('.epub-reader:visible iframe')
        .evaluate((el) => el === Reflect.get(window, 'retainedEpubNode')),
    ).toBe(true)
    await expect(page.locator('.session-panel:not(.session-inactive) .loading-card')).toHaveCount(0)
  }
  await first.click()
  await page.clock.fastForward(240000)
  expect(
    await page
      .locator('.epub-reader iframe')
      .evaluate((el) => el === Reflect.get(window, 'retainedEpubNode')),
  ).toBe(true)
  await page.clock.fastForward(61000)
  await expect(page.locator('.epub-reader')).toHaveCount(0)
  await expect(page.locator('.pdf-reader')).toHaveCount(1)
  await expect(page.getByRole('spinbutton', { name: 'Current page', exact: true })).toHaveValue('2')
  await page.evaluate(() => {
    const centers: number[] = []
    Reflect.set(window, 'restorationCenters', centers)
    const observer = new MutationObserver(() => {
      const card = document.querySelector('.session-panel:not(.session-inactive) .loading-card')
      if (!card?.textContent?.includes('Restoring your reading position')) return
      const cover = card.closest('.epub-loading-cover')
      if (!cover) return
      const a = card.getBoundingClientRect(),
        b = cover.getBoundingClientRect()
      if (a.height && b.height) centers.push(Math.abs(a.y + a.height / 2 - b.y - b.height / 2))
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    Reflect.set(window, 'restorationObserver', observer)
  })
  await book.click()
  await expect(
    page
      .locator('.epub-reader:visible')
      .frameLocator('iframe')
      .getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  expect(
    await page
      .locator('.epub-reader:visible iframe')
      .evaluate((el) => el === Reflect.get(window, 'retainedEpubNode')),
  ).toBe(false)
  const centers = await page.evaluate(() => {
    Reflect.get(window, 'restorationObserver').disconnect()
    return Reflect.get(window, 'restorationCenters') as number[]
  })
  expect(centers.length).toBeGreaterThan(0)
  expect(Math.max(...centers)).toBeLessThan(2)
  await page.clock.resume()
  // Burst switch/close events in one task to exercise ownership across Vue patches.
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) {
      const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      tabs[i % tabs.length]?.click()
    }
  })
  while (await page.getByRole('tab').count()) {
    await page.getByRole('tab', { selected: true }).focus()
    await page.getByRole('tab', { selected: true }).press('Delete')
  }
  await expect(page.getByRole('heading', { name: 'Welcome to PaperTrail' })).toBeVisible()
  await page.getByRole('button', { name: 'Show library', exact: true }).click()
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'after-burst.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(4),
  })
  await page.getByRole('button', { name: 'PDF: after-burst.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  expect(errors).toEqual([])
})

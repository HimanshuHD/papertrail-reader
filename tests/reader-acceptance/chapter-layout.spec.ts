import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const constrained of [false, true])
  test(`short chapters fill the viewport with outer-only scrolling (constrained=${constrained})`, async ({
    page,
  }) => {
    const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Short chapter</title><style>body{${constrained ? 'height:110px;overflow-y:auto;' : ''}}h1{font-size:72px;line-height:1}p{font-size:40px}</style></head><body><h1>A short title with wrapping text</h1><p>Author name</p></body></html>`
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'short.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ chapter })),
    })
    await page.getByRole('button', { name: 'EPUB: short.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader:visible')
    const check = async () => {
      await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
      await expect
        .poll(async () =>
          reader.locator('.epub-host').evaluate((host) => {
            const frame = host.querySelector('iframe')!,
              doc = frame.contentDocument!
            const body = doc.body,
              html = doc.documentElement
            const viewport = host.clientHeight
            return {
              frameFills: frame.getBoundingClientRect().height >= viewport - 1,
              pageFills: body.getBoundingClientRect().height >= viewport - 1,
              innerScroll: doc.defaultView!.getComputedStyle(body).overflowY,
              rootScroll: doc.defaultView!.getComputedStyle(html).overflowY,
              outerFits: host.querySelector('.epub-container')!.clientHeight >= viewport - 1,
              shortPageFits: host.querySelector('.epub-container')!.scrollHeight <= viewport + 1,
            }
          }),
        )
        .toEqual({
          frameFills: true,
          pageFills: true,
          innerScroll: 'visible',
          rootScroll: 'hidden',
          outerFits: true,
          shortPageFits: true,
        })
      await expect(reader.locator('.epub-loading-cover')).toHaveCount(0)
    }
    await check()
    await page.setViewportSize({ width: 900, height: 700 })
    await check()
    await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: 'Second chapter' }),
    ).toBeVisible()
    await check()
  })

test('long chapters retain outer scrolling and their final text', async ({ page }) => {
  const { createFormattedEpubFixture } = await import('../fixtures/epub')
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'long.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createFormattedEpubFixture(40)),
  })
  await page.getByRole('button', { name: 'EPUB: long.epub', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  const scroll = reader.locator('.epub-container')
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(
    reader
      .frameLocator('iframe')
      .getByText('Reading paragraph 39. Local text flows across the reader.', { exact: true }),
  ).toBeInViewport()
  expect(
    await reader
      .frameLocator('iframe')
      .locator('body')
      .evaluate((body) => body.scrollTop),
  ).toBe(0)
})

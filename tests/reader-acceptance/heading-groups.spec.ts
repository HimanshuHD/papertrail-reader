import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('author heading groups retain hierarchy, spacing and semantic selectors across modes and resize', async ({
  page,
}) => {
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:book="http://www.idpf.org/2007/ops" xml:lang="en-GB"><head><title>Grouped heading</title><style>@namespace book "http://www.idpf.org/2007/ops";hgroup{margin:2em 0;text-align:center;font-variant:small-caps}hgroup>*{margin:0;font-weight:normal}hgroup>:first-child{font-weight:700}hgroup>h2{font-size:2em;margin-bottom:1em}section[book|type~="chapter"] hgroup>p{font-variant-caps:small-caps;text-align:center;font-size:1.2em}</style></head><body><section book:type="chapter"><hgroup><h2>V</h2><p book:type="title">A Generated Chapter Title</p></hgroup><p>Distinct readable body text.</p></section></body></html>`
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'heading.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  })
  await page.getByRole('button', { name: 'EPUB: heading.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  const ready = () =>
    expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
  const check = async () => {
    await ready()
    const frame = reader.frameLocator('iframe')
    await expect(frame.locator('hgroup')).toHaveCount(1)
    const style = await frame.locator('hgroup').evaluate((group) => {
      const doc = group.ownerDocument,
        win = doc.defaultView!,
        number = group.querySelector('h2')!,
        title = group.querySelector('p')!
      return {
        weight: win.getComputedStyle(number).fontWeight,
        align: win.getComputedStyle(title).textAlign,
        caps: win.getComputedStyle(title).fontVariantCaps,
        gap: group.getBoundingClientRect().top - doc.body.getBoundingClientRect().top,
        lang: doc.documentElement.lang,
        semantic: group.closest('section')!.getAttribute('data-reader-epub-type'),
      }
    })
    expect(style.weight).toBe('700')
    expect(style.align).toBe('center')
    expect(style.caps).toBe('small-caps')
    expect(style.gap).toBeGreaterThan(20)
    expect(style.lang).toBe('en-GB')
    expect(style.semantic).toBe('chapter')
    await expect(frame.getByText('Distinct readable body text.', { exact: true })).toBeVisible()
    // The authored group fits; it should not create a second or needless outer scrollbar.
    const container = reader.locator('.epub-container')
    await expect
      .poll(() => container.evaluate((el) => el.scrollHeight - el.clientHeight))
      .toBeLessThanOrEqual(1)
  }
  await check()
  await page.setViewportSize({ width: 900, height: 700 })
  await check()
  const mode = reader.getByRole('switch', { name: 'Text-only view', exact: true })
  for (const textOnly of [true, false]) {
    await reader
      .locator('iframe')
      .evaluate((frame) => frame.setAttribute('data-old-heading', 'true'))
    await mode.click()
    await expect(reader.locator('iframe[data-old-heading]')).toHaveCount(0)
    await ready()
    await expect(reader.frameLocator('iframe').locator('hgroup')).toHaveCount(1)
    if (!textOnly) await check()
  }
})

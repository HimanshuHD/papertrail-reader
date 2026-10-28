import { expect, test } from '@playwright/test'
import { createSvgFidelityEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('detailed SVG paths, author sizing and owned wrappers remain complete across chapters', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'vector.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createSvgFidelityEpubFixture()),
  })
  await page.getByRole('button', { name: 'EPUB: vector.epub', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  const ready = () => expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
  const check = async () => {
    await ready()
    const picture = reader.frameLocator('iframe').locator('.picture')
    await expect(picture).toBeVisible()
    await expect
      .poll(() => picture.evaluate((element) => element.getBoundingClientRect().width))
      .toBeCloseTo(240, 0)
    const rendered = await picture.evaluate(async (element) => {
      const doc = element.ownerDocument
      const source =
        element.localName === 'img'
          ? (element as HTMLImageElement).src
          : element.querySelector('image')!.getAttribute('href')!
      const img = doc.createElement('img')
      img.src = source
      await img.decode()
      const canvas = doc.createElement('canvas')
      canvas.width = 320
      canvas.height = 200
      const context = canvas.getContext('2d')!
      context.drawImage(img, 0, 0, 320, 200)
      const heading = doc.querySelector('h1')!
      const box = element.getBoundingClientRect(),
        body = doc.body.getBoundingClientRect()
      return {
        pixel: [...context.getImageData(160, 100, 1, 1).data],
        alignment: doc.defaultView!.getComputedStyle(heading).textAlign,
        center: Math.abs(box.left + box.width / 2 - (body.left + body.width / 2)),
        source,
      }
    })
    expect(rendered.pixel).toEqual([18, 52, 86, 255])
    expect(rendered.alignment).toBe('center')
    expect(rendered.center).toBeLessThan(2)
    await expect(reader.getByRole('status', { name: 'Illustration notice' })).toHaveCount(0)
    return rendered.source
  }
  const first = await check()
  await page.setViewportSize({ width: 900, height: 700 })
  await check()
  await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
  await ready()
  const next = await check()
  expect(next).not.toBe(first)
  await reader.getByRole('button', { name: 'Previous chapter', exact: true }).click()
  await ready()
  expect(await check()).not.toBe(first)
})

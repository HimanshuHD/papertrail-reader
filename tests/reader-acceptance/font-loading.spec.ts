import { expect, test } from '@playwright/test'
import { createFontEpubFixture } from '../fixtures/epub'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const format of ['ttf', 'woff', 'woff2', 'otf'] as const)
  test(`embedded ${format} font metrics and mappings survive mode changes and navigation`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    const files = [
      {
        name: 'fonts.epub',
        mimeType: 'application/epub+zip',
        buffer: Buffer.from(await createFontEpubFixture(format)),
      },
      { name: 'fonts.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    ]
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    await page.getByRole('button', { name: 'EPUB: fonts.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader:visible')
    const ready = () =>
      expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
    const check = async () => {
      await ready()
      await expect(reader.getByRole('status', { name: 'Font notice' })).toHaveCount(0)
      await expect
        .poll(() =>
          reader
            .frameLocator('iframe')
            .locator('#probe')
            .evaluate((e) => e.getBoundingClientRect().width),
        )
        .toBeCloseTo(84, 0)
      const faces = await reader
        .frameLocator('iframe')
        .locator('body')
        .evaluate((body) => {
          const result: { family: string; weight: string; style: string; status: string }[] = []
          for (const face of body.ownerDocument.fonts.values())
            result.push({
              family: face.family.replaceAll('"', ''),
              weight: face.weight,
              style: face.style,
              status: face.status,
            })
          return result
        })
      expect(faces.filter((face) => face.family === 'PaperTrail Generated Fixture')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ weight: 'normal', style: 'normal', status: 'loaded' }),
          expect.objectContaining({ weight: '700', style: 'normal', status: 'loaded' }),
          expect.objectContaining({ weight: 'normal', style: 'italic', status: 'loaded' }),
        ]),
      )
    }
    await check()
    await page.setViewportSize({ width: 900, height: 700 })
    await check()
    const passage = reader.frameLocator('iframe').locator('#font-line-25')
    await reader.locator('iframe').evaluate((frame) => {
      const doc = (frame as HTMLIFrameElement).contentDocument!,
        container = frame.closest('.epub-container')!
      container.dispatchEvent(new WheelEvent('wheel'))
      container.scrollTop +=
        frame.getBoundingClientRect().top +
        doc.querySelector('#font-line-25')!.getBoundingClientRect().top -
        container.getBoundingClientRect().top
    })
    await expect(passage).toBeInViewport()
    const mode = reader.getByRole('switch', { name: 'Text-only view', exact: true })
    for (const textOnly of [true, false]) {
      await reader
        .locator('iframe')
        .evaluate((frame) => frame.setAttribute('data-old-view', 'true'))
      await mode.click()
      await expect(reader.locator('iframe[data-old-view]')).toHaveCount(0)
      await ready()
      await expect(passage).toBeInViewport()
      if (textOnly) {
        expect(
          await reader
            .frameLocator('iframe')
            .locator('body')
            .evaluate((body) => body.ownerDocument.fonts.size),
        ).toBe(0)
      } else await check()
    }
    if (format === 'ttf') {
      await reader.getByRole('button', { name: 'Typography', exact: true }).click()
      await reader.getByRole('button', { name: 'Increase font size', exact: true }).click()
      await expect
        .poll(() =>
          reader
            .frameLocator('iframe')
            .locator('#probe')
            .evaluate((e) => e.getBoundingClientRect().width),
        )
        .toBeGreaterThan(84)
      await reader.getByRole('button', { name: 'Reset typography', exact: true }).click()
      await check()
      await expect(passage).toBeInViewport()
      await reader.getByRole('button', { name: 'Typography', exact: true }).click()
      await reader
        .locator('iframe')
        .evaluate((frame) => frame.setAttribute('data-warm-font-frame', 'true'))
      await page.getByRole('button', { name: 'Show library', exact: true }).click()
      await page.getByRole('button', { name: 'PDF: fonts.pdf', exact: true }).click()
      await page.getByRole('button', { name: 'Hide library', exact: true }).click()
      await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
        'aria-busy',
        'false',
        { timeout: 15000 },
      )
      await page.getByRole('tab', { name: /EPUB: fonts.epub/ }).click()
      await check()
      await expect(reader.locator('iframe[data-warm-font-frame]')).toHaveCount(1)
      await expect(passage).toBeInViewport()
      await page.reload()
      await waitForWorkspaceReady(page)
      await page.getByRole('button', { name: 'Reconnect local document', exact: true }).click()
      await page.locator('input[accept*=".pdf"]').setInputFiles(files)
      const hide = page.getByRole('button', { name: 'Hide library', exact: true })
      if (await hide.isVisible()) await hide.click()
      await page.getByRole('tab', { name: /EPUB: fonts.epub/ }).click()
      await check()
      await expect(passage).toBeInViewport()
    }
    await reader.getByRole('button', { name: 'Next chapter', exact: true }).click()
    await ready()
    await reader.getByRole('button', { name: 'Previous chapter', exact: true }).click()
    await check()
  })

test('malformed embedded fonts leave readable fallback and an accessible notice', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'fallback-font.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(await createFontEpubFixture('ttf', true)),
  })
  await page.getByRole('button', { name: 'EPUB: fallback-font.epub', exact: true }).click()
  const reader = page.locator('.epub-reader:visible')
  await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', {
    timeout: 15000,
  })
  await expect(reader.getByRole('status', { name: 'Font notice' })).toContainText('fallback fonts')
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Embedded font chapter' }),
  ).toBeVisible()
})

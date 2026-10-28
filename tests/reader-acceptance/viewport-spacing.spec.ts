import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const inline of [false, true]) {
  test(`reader-sized chapter spacing and passage restoration (${inline ? 'inline' : 'sheet'})`, async ({
    page,
  }) => {
    const css = 'section{margin-top:20vh}p{margin:1em 0}'
    const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Viewport chapter</title>${inline ? '' : `<style>${css}</style>`}</head><body><section id="chapter" ${inline ? 'style="margin-top:20vh"' : ''}><h1>Viewport chapter</h1>${Array.from({ length: 250 }, (_, i) => `<p id="line-${i}">Passage ${i}. This uniquely numbered paragraph keeps a logical reading position across layout changes.</p>`).join('')}</section></body></html>`
    const files = [
      {
        name: 'viewport.epub',
        mimeType: 'application/epub+zip',
        buffer: Buffer.from(createEpubFixture({ chapter })),
      },
      { name: 'viewport.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    ]
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    await page.getByRole('button', { name: 'EPUB: viewport.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.epub-reader:visible'),
      frame = reader.locator('iframe')
    const ready = () => expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false')
    const spacing = async () => {
      await ready()
      await expect
        .poll(() =>
          frame.evaluate((f) => {
            const doc = (f as HTMLIFrameElement).contentDocument!,
              c = f.closest('.epub-container')!
            return Math.abs(
              parseFloat(
                doc.defaultView!.getComputedStyle(doc.querySelector('section')!).marginTop,
              ) -
                c.clientHeight * 0.2,
            )
          }),
        )
        .toBeLessThan(2)
    }
    const toggle = async () => {
      await frame.evaluate((f) => f.setAttribute('data-old-view', 'true'))
      await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
      await expect(reader.locator('iframe[data-old-view]')).toHaveCount(0)
      await ready()
    }
    await spacing()
    // A mode switch in the leading blank space must keep the chapter opening visible.
    await toggle()
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: 'Viewport chapter', exact: true }),
    ).toBeInViewport()
    await toggle()
    await spacing()
    await page.setViewportSize({ width: 900, height: 700 })
    await spacing()
    const passage = reader.frameLocator('iframe').locator('#line-120')
    await frame.evaluate(async (f) => {
      const doc = (f as HTMLIFrameElement).contentDocument!,
        c = f.closest('.epub-container')!,
        p = doc.querySelector('#line-120')!
      c.dispatchEvent(new WheelEvent('wheel'))
      c.scrollTop +=
        p.getBoundingClientRect().top +
        f.getBoundingClientRect().top -
        c.getBoundingClientRect().top
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await expect(passage).toBeInViewport()
    await toggle()
    await expect(passage).toBeInViewport()
    await toggle()
    await expect(passage).toBeInViewport()
    await spacing()
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: viewport.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('tab', { name: /EPUB: viewport.epub/ }).click()
    await ready()
    await expect(passage).toBeInViewport()
    await spacing()
    await page.reload()
    await waitForWorkspaceReady(page)
    await page.getByRole('button', { name: 'Reconnect local document', exact: true }).click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(files)
    const hide = page.getByRole('button', { name: 'Hide library', exact: true })
    if (await hide.isVisible()) await hide.click()
    await ready()
    await expect(passage).toBeInViewport()
    await spacing()
  })
}

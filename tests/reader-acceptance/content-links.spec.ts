import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'
for (const mode of ['pdf', 'epub-formatted', 'epub-text'] as const)
  test(`${mode} content links navigate internally and require external consent`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000)
    let externalRequests = 0
    await context.route('https://example.test/reader-link', async (route) => {
      externalRequests++
      await route.fulfill({
        contentType: 'text/html',
        body: '<title>Confirmed destination</title><p>Opened after consent</p>',
      })
    })
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    const pdf = mode === 'pdf'
    const chapter =
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Linked chapter</title></head><body><h1 id="start">Linked chapter</h1><p><a href="two.xhtml#target">Go to second chapter</a></p><p><a href="#note">Jump to note</a></p><p><a href="https://example.test/reader-link">Open website</a></p><p><a href="missing.xhtml">Missing destination</a></p><p><a href="javascript:alert(1)">Unsafe action</a></p>' +
      '<p>Readable filler text.</p>'.repeat(90) +
      '<p id="note">Footnote destination</p><a href="#start">Return to chapter start</a></body></html>'
    const epub = createEpubFixture({
      chapter,
      files: {
        'OPS/two.xhtml': new TextEncoder().encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><h1 id="target">Linked target chapter</h1><a href="one.xhtml#start">Return to first chapter</a></body></html>',
        ),
      },
    })
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: pdf ? 'links.pdf' : 'links.epub',
      mimeType: pdf ? 'application/pdf' : 'application/epub+zip',
      buffer: pdf ? createPdfFixture(2, undefined, false, 0, true) : Buffer.from(epub),
    })
    await page
      .getByRole('button', { name: pdf ? 'PDF: links.pdf' : 'EPUB: links.epub', exact: true })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator(pdf ? '.pdf-reader:visible' : '.epub-reader:visible')
    if (pdf)
      await expect(reader.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
        'aria-busy',
        'false',
        { timeout: 15000 },
      )
    else {
      await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', {
        timeout: 15000,
      })
      if (mode === 'epub-text') {
        await reader.getByRole('switch', { name: 'Text-only view', exact: true }).click()
        await expect(reader.locator('.epub-host')).toHaveAttribute('aria-busy', 'false', {
          timeout: 15000,
        })
      }
    }
    const link = (name: string) =>
      pdf
        ? reader.getByRole('link', { name, exact: true })
        : reader.frameLocator('iframe').getByRole('link', { name, exact: true })
    const external = link('Open website')
    await expect(external).toBeVisible()
    if (pdf) await expect(external).toHaveCSS('border-bottom-style', 'solid')
    else await expect(external).toHaveCSS('text-decoration-line', 'underline')
    await expect(external).not.toHaveAttribute('href')
    await external.click({ modifiers: ['Control'] })
    const dialog = page.getByRole('dialog', { name: 'Open external link?', exact: true })
    await expect(dialog).toContainText('https://example.test/reader-link')
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancel).toBeFocused()
    expect(context.pages()).toHaveLength(1)
    expect(externalRequests).toBe(0)
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Open link', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(external).toBeFocused()
    await external.click({ button: 'middle' })
    await expect(dialog).toBeVisible()
    await cancel.click()
    await external.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    const opened = context.waitForEvent('page')
    await dialog.getByRole('button', { name: 'Open link', exact: true }).click()
    const popup = await opened
    await popup.waitForURL('https://example.test/reader-link')
    expect(
      await popup.evaluate(() => ({ opener: window.opener, referrer: document.referrer })),
    ).toEqual({ opener: null, referrer: '' })
    expect(externalRequests).toBe(1)
    await popup.close()
    await expect(dialog).toHaveCount(0)
    await link('Missing destination').click()
    await expect(
      reader.getByRole('status').filter({ hasText: 'unavailable or unsupported' }),
    ).toBeVisible()
    await link('Unsafe action').click()
    expect(context.pages()).toHaveLength(1)
    if (pdf) {
      await link('Go to second page').click()
      await expect(reader.locator('[data-pdf-page="2"]')).toBeInViewport()
      await reader.getByRole('button', { name: 'Previous page', exact: true }).click()
      await link('Named chapter link').click()
      await expect(reader.locator('[data-pdf-page="2"]')).toBeInViewport()
    } else {
      await link('Jump to note').click()
      await expect(
        reader.frameLocator('iframe').getByText('Footnote destination', { exact: true }),
      ).toBeInViewport()
      await link('Return to chapter start').click()
      await link('Go to second chapter').click()
      await expect(
        reader.frameLocator('iframe').getByRole('heading', { name: 'Linked target chapter' }),
      ).toBeInViewport()
      await link('Return to first chapter').click()
      await expect(
        reader.frameLocator('iframe').getByRole('heading', { name: 'Linked chapter' }),
      ).toBeInViewport()
    }
  })

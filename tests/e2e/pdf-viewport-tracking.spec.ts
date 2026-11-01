import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady, settleReaderLayout } from '../fixtures/browser'

for (const rotation of [0, 90]) {
  test(`distant PDF jumps survive layout changes and reopening (${rotation} degree pages)`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'viewport.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(60, undefined, false, rotation),
    })
    await page.getByRole('button', { name: 'PDF: viewport.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
    const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
    const target = page.locator('[data-pdf-page="48"]')
    await expect(pane).toHaveAttribute('aria-busy', 'false')
    await field.fill('48')
    await field.press('Tab')
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
      'data-render-state',
      'pending',
    )
    expect(
      await page
        .locator('[data-pdf-page="1"] canvas')
        .evaluate((canvas) => (canvas as HTMLCanvasElement).width),
    ).toBe(0)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    const spread = page.getByRole('button', { name: 'Two-page view', exact: true })
    await spread.click()
    await expect(spread).toHaveAttribute('aria-pressed', 'true')
    await settleReaderLayout(page.locator('.reader-layout'))
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    await page.setViewportSize({ width: 768, height: 900 })
    await settleReaderLayout(page.locator('.reader-layout'))
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    // At narrow widths, spread/resize can make a neighbouring page most visible.
    // Restoration must retain the settled reading state, not the initial jump's page number.
    await settleReaderLayout(pane)
    const savedPage = await field.inputValue()
    // Close persists the viewport anchor and spread; opening must render its distant target.
    await page.getByRole('button', { name: 'Close viewport.pdf', exact: true }).click()
    await expect(page.locator('.pdf-reader')).toHaveCount(0)
    await page.getByRole('button', { name: 'Show library', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: viewport.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await expect(pane).toHaveAttribute('aria-busy', 'false')
    await expect(field).toHaveValue(savedPage)
    await expect(spread).toHaveAttribute('aria-pressed', 'true')
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    expect(errors).toEqual([])
  })
}

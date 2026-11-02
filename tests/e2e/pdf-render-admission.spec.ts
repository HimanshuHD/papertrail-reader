import { expect, test } from '@playwright/test'
import { createPdfFixture, createImagePdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

test.use({ deviceScaleFactor: 2 })
for (const fixture of ['rotated-text', 'image'] as const) {
  test(`${fixture} keeps full-density 400% rendering after rapid zoom and distant navigation`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'admission.pdf',
      mimeType: 'application/pdf',
      buffer:
        fixture === 'image' ? createImagePdfFixture() : createPdfFixture(12, undefined, false, 90),
    })
    await page.getByRole('button', { name: 'PDF: admission.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    const reader = page.locator('.pdf-reader')
    await expect(reader.locator('[data-pdf-page="1"]')).toHaveAttribute(
      'data-render-state',
      'ready',
    )
    const zoom = page.getByRole('spinbutton', { name: 'PDF zoom percent', exact: true })
    const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
    for (const [value, destination] of [
      [400, 2],
      [100, 9],
      [400, 12],
    ]) {
      await zoom.fill(String(value))
      await zoom.press('Enter')
      await field.fill(String(destination))
      await field.press('Tab')
    }
    const target = reader.locator('[data-pdf-page="12"]')
    await expect(target).toHaveAttribute('data-render-state', 'ready')
    await expect(zoom).toHaveValue('400')
    const dimensions = await target.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
      expectedWidth: Math.floor(parseFloat(canvas.style.width) * devicePixelRatio),
      expectedHeight: Math.floor(parseFloat(canvas.style.height) * devicePixelRatio),
    }))
    expect(dimensions.width).toBe(dimensions.expectedWidth)
    expect(dimensions.height).toBe(dimensions.expectedHeight)
    await expect(reader.locator('[data-pdf-page="1"] canvas')).toHaveCount(0)
    await page.getByRole('button', { name: 'Close admission.pdf', exact: true }).click()
    await expect(reader).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

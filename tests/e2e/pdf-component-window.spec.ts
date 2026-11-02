import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { settleReaderLayout, waitForWorkspaceReady } from '../fixtures/browser'

test('a 1,001-page PDF mounts a nearby component window through distant jumps and spreads', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'window.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(1001),
  })
  await page.getByRole('button', { name: 'PDF: window.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pane).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('[data-pdf-page]')).toHaveCount(1001)
  const canvases = page.locator('.pdf-page-shell canvas')
  await expect.poll(() => canvases.count()).toBeLessThan(12)
  const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  for (const target of [900, 1001, 1]) {
    await field.fill(String(target))
    await field.press('Tab')
    await expect(page.locator(`[data-pdf-page="${target}"]`)).toHaveAttribute(
      'data-render-state',
      'ready',
    )
    await expect.poll(() => canvases.count()).toBeLessThan(12)
  }
  await field.fill('900')
  await field.press('Tab')
  const distant = page.locator('[data-pdf-page="1"]')
  await expect(distant).toHaveAttribute('data-virtual-placeholder', '')
  await expect(distant.locator('canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Two-page view', exact: true }).click()
  await settleReaderLayout(page.locator('.reader-layout'))
  await field.fill('1001')
  await field.press('Tab')
  await expect(page.locator('[data-pdf-page="1001"]')).toHaveAttribute('data-render-state', 'ready')
  await expect.poll(() => canvases.count()).toBeLessThan(20)
  await page.getByRole('button', { name: 'Close window.pdf', exact: true }).click()
  await expect(page.locator('.pdf-page-shell')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('mixed page sizes survive unmounting, resize and an odd final spread', async ({ page }) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const sizes = Array.from({ length: 51 }, (_, index) =>
    index % 2 ? { width: 900, height: 450 } : { width: 500, height: 1100 },
  )
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'mixed.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(51, undefined, false, 0, false, sizes),
  })
  await page.getByRole('button', { name: 'PDF: mixed.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  const target = page.locator('[data-pdf-page="40"]')
  const size = () =>
    target.locator('.pdf-page').evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }))
  await field.fill('40')
  await field.press('Tab')
  await expect(target).toHaveAttribute('data-render-state', 'ready')
  const measured = await size()
  expect(measured.width / measured.height).toBeCloseTo(2, 2)
  await field.fill('1')
  await field.press('Tab')
  await expect(target).toHaveAttribute('data-virtual-placeholder', '')
  expect(await size()).toEqual(measured)
  await page.getByRole('button', { name: 'Two-page view', exact: true }).click()
  await page.setViewportSize({ width: 768, height: 900 })
  await settleReaderLayout(page.locator('.reader-layout'))
  await field.fill('51')
  await field.press('Tab')
  await expect(page.locator('[data-pdf-page="51"]')).toHaveAttribute('data-render-state', 'ready')
  await field.fill('40')
  await field.press('Tab')
  await expect(target).toHaveAttribute('data-render-state', 'ready')
  const remounted = await size()
  expect(remounted.width / remounted.height).toBeCloseTo(2, 2)
})

test('selected text stays mounted while scrolling away and releases after selection clears', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'selection.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(60),
  })
  await page.getByRole('button', { name: 'PDF: selection.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pane).toHaveAttribute('aria-busy', 'false')
  const zoom = page.getByRole('spinbutton', { name: 'PDF zoom percent', exact: true })
  await zoom.fill('25')
  await zoom.press('Enter')
  await zoom.press('Tab')
  await expect(page.locator('[data-pdf-page="2"]')).toHaveAttribute('data-render-state', 'ready')
  await pane.focus()
  await page.evaluate(() => {
    const first = document.querySelector('[data-pdf-page="1"] .textLayer span')!.firstChild!
    const last = document.querySelector('[data-pdf-page="2"] .textLayer span')!.firstChild!
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(last, last.textContent!.length)
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const originalSelection = await page.evaluate(() => document.getSelection()!.toString())
  await page.keyboard.press('Shift+ArrowLeft')
  const selected = await page.evaluate(() => document.getSelection()!.toString())
  expect(selected).toBe(originalSelection.slice(0, -1))
  await pane.evaluate((el) => {
    const target = el.querySelector('[data-pdf-page="40"]')!
    el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top
  })
  await expect(page.locator('[data-pdf-page="40"]')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.locator('[data-pdf-page="1"] canvas')).toHaveCount(1)
  expect(await page.evaluate(() => document.getSelection()!.toString())).toBe(selected)
  await page.evaluate(() => {
    document.getSelection()!.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))
  })
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-virtual-placeholder', '')
})

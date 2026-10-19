import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady, settleReaderLayout } from '../fixtures/browser'

test('compact headers, editable zoom and conditional tab actions retain reader space', async ({
  page,
}) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const height = (selector: string) =>
    page.locator(selector).evaluate((element) => element.getBoundingClientRect().height)
  await expect.poll(() => height('.workspace-brand')).toBe(46)
  await expect.poll(() => height('.library-panel > header')).toBe(56)
  await expect(page.getByRole('button', { name: 'Add local documents from tabs' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open document list' })).toHaveCount(0)
  const close = page.getByRole('button', { name: 'Hide library', exact: true })
  expect(await close.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  const theme = page.getByRole('button', { name: 'Dark mode', exact: true })
  expect(await theme.evaluate((el) => el.getBoundingClientRect().height)).toBe(34)
  const before = await theme.evaluate((el) => getComputedStyle(el, '::before').transform)
  await theme.click()
  await expect(theme).toHaveAttribute('aria-pressed', 'true')
  await settleReaderLayout(page.locator('.reader-layout'))
  expect(await theme.evaluate((el) => getComputedStyle(el, '::before').transform)).not.toBe(before)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'compact.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(3),
  })
  await page.getByRole('button', { name: 'PDF: compact.pdf', exact: true }).click()
  await close.click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await settleReaderLayout(page.locator('.reader-layout'))
  expect(await height('.workspace-topbar')).toBe(46)
  expect(await height('.workspace-brand')).toBe(46)
  expect(await height('.pdf-header')).toBe(56)
  const previous = page.getByRole('button', { name: 'Previous page', exact: true })
  expect(
    await previous.evaluate((el) => [
      el.getBoundingClientRect().width,
      el.getBoundingClientRect().height,
    ]),
  ).toEqual([40, 40])
  const pageInput = page.getByRole('spinbutton', { name: 'Current page', exact: true })
  expect(
    await pageInput.evaluate((el) => [
      el.getBoundingClientRect().height,
      getComputedStyle(el).fontSize,
    ]),
  ).toEqual([32, '13px'])
  const zoom = page.getByRole('spinbutton', { name: 'PDF zoom percent', exact: true })
  await expect(zoom).toHaveAttribute('max', '400')
  await zoom.fill('900')
  await zoom.press('Enter')
  await expect(zoom).toHaveValue('400')
  await zoom.fill('150')
  await zoom.press('Enter')
  await expect(zoom).toHaveValue('150')
  await pageInput.fill('2')
  await pageInput.press('Tab')
  await expect(pageInput).toHaveValue('2')
  await expect(page.locator('.pdf-header > div > p')).toHaveText('Page 2 of 3 · 67%')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

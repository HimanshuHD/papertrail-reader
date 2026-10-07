import { chromium, expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'

test.skip(
  ({ viewport }) => viewport?.width !== 1440,
  'Native focus is viewport-independent; execute once at 1440px.',
)
test('native browser tab focus pauses and resumes the reading timer without synthetic focus events', async ({
  baseURL,
}) => {
  // Only the persistent default context supports disabling Playwright's focus override.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    noDefaults: true,
    baseURL,
    viewport: { width: 1440, height: 900 },
  })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await page.clock.install()
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'focus.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(1),
    })
    await page.getByRole('button', { name: 'PDF: focus.pdf', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(
      insights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeEnabled()
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
    await page.clock.runFor(2000)
    const time = () => insights.locator('.text-3xl').innerText()
    const other = await context.newPage()
    await other.goto('./#/')
    await other.bringToFront()
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false)
    await page.clock.runFor(1000)
    const paused = await time()
    await page.clock.runFor(5000)
    expect(await time()).toBe(paused)
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
    await page.clock.runFor(3000)
    expect(await time()).not.toBe(paused)
  } finally {
    await context.close()
  }
})

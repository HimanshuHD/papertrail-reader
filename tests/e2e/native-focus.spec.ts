import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type Browser } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'

test.skip(
  ({ viewport }) => viewport?.width !== 1440,
  'Native focus is viewport-independent; execute once at 1440px.',
)
test('native browser tab focus pauses and resumes the reading timer without synthetic focus events', async ({
  baseURL,
}) => {
  const profile = await mkdtemp(join(tmpdir(), 'papertrail-native-focus-'))
  const process = spawn(chromium.executablePath(), [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    'about:blank',
  ])
  // Drain browser output so an unread pipe cannot block the process.
  process.stdout.resume()
  process.stderr.resume()
  let browser: Browser | undefined
  try {
    let endpoint = ''
    await expect
      .poll(async () => {
        try {
          const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]
          endpoint = `http://127.0.0.1:${port}`
          return !!port
        } catch {
          return false
        }
      })
      .toBe(true)
    browser = await chromium.connectOverCDP(endpoint, { noDefaults: true })
    const context = browser.contexts()[0]!
    const page = context.pages()[0] ?? (await context.newPage())
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.clock.install()
    await page.goto(new URL('./#/app', baseURL).href)
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
    await other.goto(new URL('./#/', baseURL).href)
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
    await browser?.close()
    if (process.exitCode === null && process.signalCode === null) {
      const exited = once(process, 'exit')
      process.kill('SIGTERM')
      await exited
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

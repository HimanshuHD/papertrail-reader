// Blank-window environment check only; no application documents or synthetic focus events.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const profile = await mkdtemp(join(tmpdir(), 'papertrail-focus-probe-'))
const child = spawn(chromium.executablePath(), [
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-dev-shm-usage',
  'about:blank',
])
child.stdout.resume()
child.stderr.resume()
let browser
try {
  let port
  const started = Date.now()
  while (!port && Date.now() - started < 10000) {
    if (child.exitCode !== null) throw new Error('Native focus browser exited before CDP startup')
    try {
      port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  if (!port) throw new Error('Native focus browser did not expose CDP')
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true })
  const context = browser.contexts()[0]
  const page = context.pages()[0] ?? (await context.newPage())
  await page.bringToFront()
  await page.waitForFunction(() => document.hasFocus(), undefined, { timeout: 10000 })
  const other = await context.newPage()
  await other.bringToFront()
  await page.waitForFunction(() => !document.hasFocus(), undefined, { timeout: 10000 })
  await page.bringToFront()
  await page.waitForFunction(() => document.hasFocus(), undefined, { timeout: 10000 })
  console.log('Native window focus preflight passed: activation, deactivation and return')
} finally {
  await browser?.close()
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

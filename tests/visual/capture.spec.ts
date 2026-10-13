import { test, expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const freeze = await fs.readFile('tests/visual/freeze.css', 'utf8')

const startup = (process.env.VISUAL_PROFILE || 'startup') === 'startup'

async function capture(page: Page, info: TestInfo, state: string, regions: string[] = []) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images).map((image) => image.decode()))
  })
  const folder = path.join('visual-evidence', info.project.name)
  await fs.mkdir(folder, { recursive: true })
  const file = path.join(folder, `${state}.png`)
  const style = freeze
  const bytes = await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', style })
  await info.attach(state, { body: bytes, contentType: 'image/png' })
  for (const region of regions) {
    await page.locator(region).screenshot({
      path: path.join(folder, `${state}-${region.slice(1)}.png`),
      animations: 'disabled',
      style,
    })
  }
  await fs.writeFile(
    path.join(folder, `${state}.json`),
    JSON.stringify(
      {
        state,
        project: info.project.name,
        viewport: page.viewportSize(),
        density: 1,
        route: page.url(),
        theme: info.project.use.colorScheme,
        reducedMotion: await page.evaluate(
          () => matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
        spriteFrame: regions.length ? 0 : null,
        browser: page.context().browser()?.version(),
        os: process.platform,
        osRelease: await fs.readFile('/etc/os-release', 'utf8').catch(() => ''),
        playwright: JSON.parse(await fs.readFile('node_modules/playwright/package.json', 'utf8'))
          .version,
        runner: process.env.RUNNER_OS,
        run: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
        toolingSha: process.env.GITHUB_SHA,
        candidate: JSON.parse(await fs.readFile('dist/build.json', 'utf8')),
        screenshotSha256: createHash('sha256').update(bytes).digest('hex'),
      },
      null,
      2,
    ),
  )
}

async function ready(page: Page) {
  await expect(page.locator('#startup-loading')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'PaperTrail application' })).toBeVisible()
  await expect(page.locator('#app')).not.toHaveAttribute('inert')
}

test.beforeEach(async ({ page }, info) => {
  const theme = info.project.use.colorScheme === 'dark' ? 'dark' : 'light'
  await page.addInitScript((theme) => localStorage.setItem('papertrail.theme.v1', theme), theme)
  // Static candidate execution has no access to the runner token or arbitrary network.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === 'http://127.0.0.1:4175'
      ? route.continue()
      : route.abort('blockedbyclient')
  })
})

for (const reduced of [false, true]) {
  test(`genuine loading, readiness and shell interactions${reduced ? ' with reduced motion' : ''}`, async ({
    page,
  }, info) => {
    test.skip(!startup && reduced, 'Shell-only profile has no startup motion surface')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
    let release!: () => void
    let intercepted = false
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    if (startup)
      await page.route('**/assets/bootstrap-*.js', async (route) => {
        intercepted = true
        await held
        await route.continue()
      })
    try {
      await page.goto('./#/app', { waitUntil: 'domcontentloaded' })
      if (startup) {
        const screen = page.locator('#startup-loading')
        await expect(screen, 'Missing rendered startup surface blocks evidence').toBeVisible()
        await expect
          .poll(() => intercepted, { message: 'Actual bootstrap request must be held' })
          .toBe(true)
        await expect(screen).toHaveAttribute('data-state', 'loading')
        await expect(screen.getByRole('heading')).toHaveText('Your next chapter is loading')
        await expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
        await expect(page.locator('#app')).toHaveAttribute('inert', '')
        const book = screen.locator('.startup-book')
        await expect(book).toHaveCSS('background-size', '400% 400%')
        // Verify real animation before the capture-only style freezes frame zero.
        if (reduced) await expect(book).toHaveCSS('animation-name', 'none')
        else {
          await expect(book).not.toHaveCSS('animation-name', 'none')
          const position = await book.evaluate((el) => getComputedStyle(el).backgroundPosition)
          await expect
            .poll(() => book.evaluate((el) => getComputedStyle(el).backgroundPosition))
            .not.toBe(position)
        }
        if (reduced)
          await expect(screen.locator('.startup-track span')).toHaveCSS('animation-name', 'none')
        await expect
          .poll(() =>
            book.evaluate((el) => {
              const url = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
              if (!url) return false
              return new Promise<boolean>((resolve) => {
                const image = new Image()
                image.onload = () => resolve(image.naturalWidth > 0)
                image.onerror = () => resolve(false)
                image.src = url
              })
            }),
          )
          .toBe(true)
        await capture(page, info, reduced ? 'loading-reduced' : 'loading', [
          '.startup-brand',
          '.startup-book',
          '.startup-copy',
          '.startup-progress',
        ])
      }
    } finally {
      if (release) release()
    }
    await ready(page)
    if (!reduced) {
      await capture(page, info, 'ready')
      const hide = page.getByRole('button', { name: 'Hide library', exact: true })
      if (!(await hide.isVisible()))
        await page.getByRole('button', { name: 'Show library', exact: true }).click()
      await hide.click()
      await expect(page.getByRole('button', { name: 'Show library', exact: true })).toBeVisible()
      await capture(page, info, 'library-hidden')
      await page.getByRole('button', { name: 'Show library', exact: true }).click()
      await expect(hide).toBeVisible()
      await page
        .getByRole('button', {
          name: info.project.use.colorScheme === 'dark' ? 'Light mode' : 'Dark mode',
          exact: true,
        })
        .click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        info.project.use.colorScheme === 'dark' ? 'light' : 'dark',
      )
    }
    await fs.writeFile(info.outputPath('console.json'), JSON.stringify({ errors, expected: [] }))
    expect(errors).toEqual([])
  })
}

test('bootstrap failure is actionable and retry recovers', async ({ page }, info) => {
  test.skip(!startup, 'Shell-only profile has no bootstrap failure surface')
  const consoleErrors: string[] = [],
    pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const request = '**/assets/bootstrap-*.js'
  let aborted = false
  await page.route(request, (route) => {
    aborted = true
    return route.abort('failed')
  })
  await page.goto('./#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#startup-loading')).toHaveAttribute('data-state', 'error')
  expect(aborted).toBe(true)
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await expect(retry).toBeVisible()
  await retry.focus()
  await expect(retry).toBeFocused()
  await capture(page, info, 'error', ['.startup-copy', '.startup-progress'])
  await page.unroute(request)
  const beforeRetry = consoleErrors.length
  await retry.press('Enter')
  await ready(page)
  await capture(page, info, 'retry-ready')
  await fs.writeFile(
    info.outputPath('console.json'),
    JSON.stringify(
      {
        expectedBootstrapFailure: consoleErrors.slice(0, beforeRetry),
        afterRetry: consoleErrors.slice(beforeRetry),
        pageErrors,
      },
      null,
      2,
    ),
  )
  expect(pageErrors).toEqual([])
  expect(
    consoleErrors
      .slice(0, beforeRetry)
      .filter((error) => !/Failed to load resource: net::ERR_FAILED/.test(error)),
  ).toEqual([])
  expect(consoleErrors.slice(beforeRetry)).toEqual([])
})

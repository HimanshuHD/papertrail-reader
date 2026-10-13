import { expect, test } from '@playwright/test'

test('cold startup shows the supplied book screen and reveals the restored reader when ready', async ({
  page,
}, info) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/assets/bootstrap-*.js', async (route) => {
    await held
    await route.continue()
  })
  try {
    await page.goto('./#/app', { waitUntil: 'domcontentloaded' })
    const screen = page.locator('#startup-loading')
    await expect(screen).toBeVisible()
    await expect(screen.getByRole('heading')).toHaveText('Your next chapter is loading')
    await expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    await expect(page.locator('#app')).toHaveAttribute('inert', '')
    await expect(screen.locator('.startup-book')).toHaveCSS('background-size', '400% 400%')
    await screen.screenshot({ path: info.outputPath('startup-loading.png') })
  } finally {
    release()
  }
  await expect(page.locator('#startup-loading')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'PaperTrail application' })).toBeVisible()
  await expect(page.locator('#app')).not.toHaveAttribute('inert')
})

test('bootstrap failure retains actionable feedback and retry opens the app', async ({ page }) => {
  const block = '**/assets/bootstrap-*.js'
  await page.route(block, (route) => route.abort())
  await page.goto('./#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#startup-loading')).toHaveAttribute('data-state', 'error')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.unroute(block)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('#startup-loading')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'PaperTrail application' })).toBeVisible()
})

test('reduced motion leaves book and progress static during genuine startup', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/assets/bootstrap-*.js', async (route) => {
    await held
    await route.continue()
  })
  try {
    await page.goto('./#/app', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.startup-book')).toHaveCSS('animation-name', 'none')
    await expect(page.locator('.startup-track span')).toHaveCSS('animation-name', 'none')
  } finally {
    release()
  }
  await expect(page.locator('#startup-loading')).toHaveCount(0)
})

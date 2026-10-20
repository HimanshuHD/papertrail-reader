import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'
import { settleReaderLayout } from '../fixtures/browser'

test('compact workspace preserves reading state while resizing and closing the library', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const rail = page.getByRole('separator', { name: 'Resize library panel' })
  async function capture(name: string) {
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeEnabled()
    if (await library.count())
      await expect(
        library.getByRole('region', { name: 'Library documents', exact: true }),
      ).toHaveAttribute('aria-busy', 'false')
    await page.mouse.move(page.viewportSize()!.width - 2, page.viewportSize()!.height - 2)
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
  }
  await expect(library.locator('.workspace-brand')).toBeVisible()
  await expect(library.getByRole('contentinfo')).toBeVisible()
  await expect(page.locator('.reader-app > .app-header')).toHaveCount(0)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'workspace-layout.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(8),
  })
  await library.getByRole('button', { name: /PDF: workspace-layout.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('2')
  const opener = page.getByRole('button', { name: 'Show library', exact: true })
  await expect(page.locator('.workspace-topbar .workspace-brand')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toHaveCount(0)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await capture('library-closed-dark')
  await opener.click()
  await expect(page.getByRole('button', { name: 'Hide library', exact: true })).toBeFocused()
  await rail.focus()
  await rail.press('Home')
  const narrow = await rail.getAttribute('aria-valuenow')
  const actions = library.getByRole('button', { name: 'Library actions', exact: true })
  await expect(actions).toBeVisible()
  const closeBounds = (await library.getByRole('button', { name: 'Hide library' }).boundingBox())!
  const libraryBounds = (await library.boundingBox())!
  expect(closeBounds.x + closeBounds.width).toBeLessThanOrEqual(
    libraryBounds.x + libraryBounds.width,
  )
  await expect(
    library.getByRole('button', { name: 'Add local documents', exact: true }),
  ).toHaveCount(0)
  await actions.click()
  await expect(library.getByRole('menuitem', { name: 'Choose folder', exact: true })).toBeFocused()
  await expect(library.getByRole('menuitem', { name: 'Reselect files', exact: true })).toBeVisible()
  await expect(library.getByRole('menuitem', { name: 'Forget library', exact: true })).toBeVisible()
  await capture('library-narrow-actions-dark')
  await page.keyboard.press('Escape')
  await expect(actions).toBeFocused()
  await expect(library).toBeVisible()
  await actions.click()
  const chooserPromise = page.waitForEvent('filechooser')
  await library.getByRole('menuitem', { name: 'Reselect files', exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles([])
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('2')
  await settleReaderLayout(page.locator('.reader-layout'))
  const closedWidth = (await page.locator('.reader-column').boundingBox())!.width
  await opener.click()
  await expect(rail).toHaveAttribute('aria-valuenow', narrow!)
  await rail.focus()
  await rail.press('End')
  if (info.project.use.viewport!.width >= 375) {
    await expect(
      library.getByRole('button', { name: 'Add local documents', exact: true }),
    ).toBeVisible()
    await expect(actions).toHaveCount(0)
  } else await expect(actions).toBeVisible()
  await settleReaderLayout(page.locator('.reader-layout'))
  if (info.project.use.viewport!.width >= 1024)
    expect((await page.locator('.reader-column').boundingBox())!.width).toBeLessThan(closedWidth)
  await rail.focus()
  await rail.press('Home')
  for (let step = 0; step < 4; step++) await rail.press('ArrowRight')
  await rail.press('Shift+ArrowRight')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await capture('library-open-light')
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((el) => el.clientWidth),
  )
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('2')
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

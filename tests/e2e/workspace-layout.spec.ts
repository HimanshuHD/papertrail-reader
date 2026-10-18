import { expect, test } from '@playwright/test'
import { createPdfFixture } from '../fixtures/pdf'

test('compact workspace preserves reading state while resizing and closing the library', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const rail = page.getByRole('separator', { name: 'Resize library panel' })
  await expect(library.locator('.workspace-brand')).toBeVisible()
  await expect(library.getByRole('contentinfo')).toBeVisible()
  await expect(page.locator('.reader-app > .app-header')).toHaveCount(0)
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'workspace-layout.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(3),
  })
  await library.getByRole('button', { name: /PDF: workspace-layout.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
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
  await info.attach('library-closed-dark', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await opener.click()
  await expect(page.getByRole('button', { name: 'Hide library', exact: true })).toBeFocused()
  await rail.focus()
  await rail.press('Home')
  const narrow = await rail.getAttribute('aria-valuenow')
  const actions = library.getByRole('button', { name: 'Library actions', exact: true })
  await expect(actions).toBeVisible()
  await expect(
    library.getByRole('button', { name: 'Add local documents', exact: true }),
  ).toHaveCount(0)
  await actions.click()
  await expect(library.getByRole('menuitem', { name: 'Choose folder', exact: true })).toBeFocused()
  await expect(library.getByRole('menuitem', { name: 'Reselect files', exact: true })).toBeVisible()
  await expect(library.getByRole('menuitem', { name: 'Forget library', exact: true })).toBeVisible()
  await info.attach('library-narrow-actions-dark', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
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
  if (info.project.use.viewport!.width >= 1024)
    expect((await page.locator('.reader-column').boundingBox())!.width).toBeLessThan(closedWidth)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await info.attach('library-open-light', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
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

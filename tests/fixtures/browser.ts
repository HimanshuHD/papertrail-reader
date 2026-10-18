import { expect, type Locator, type Page } from '@playwright/test'

/** File-input injection bypasses actionability; wait for startup before inspecting sidebar state. */
export async function waitForWorkspaceReady(page: Page) {
  await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  await expect(page.locator('#startup-loading')).toBeHidden()
}

/** Finish the scroll caused by revealing a trigger before opening its dismiss-on-scroll menu. */
export async function openAnnotationActions(trigger: Locator) {
  await trigger.scrollIntoViewIfNeeded()
  await trigger.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const view = element.ownerDocument.defaultView!
        view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()))
      }),
  )
  await trigger.click()
}

/** Library actions move into the vertical menu when the current sidebar is narrow. */
export async function libraryAction(page: Page, name: string): Promise<Locator> {
  const direct = page.getByRole('button', { name, exact: true })
  if (await direct.isVisible()) return direct
  const menu = page.getByRole('menu', { name: 'Library actions', exact: true })
  if (!(await menu.isVisible()))
    await page.getByRole('button', { name: 'Library actions', exact: true }).click()
  return menu.getByRole('menuitem', { name, exact: true })
}

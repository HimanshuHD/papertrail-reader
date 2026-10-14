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

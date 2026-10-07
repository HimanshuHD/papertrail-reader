import type { Locator } from '@playwright/test'

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

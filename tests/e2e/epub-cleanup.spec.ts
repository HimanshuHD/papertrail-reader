import { expect, test } from '@playwright/test'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('closing EPUB readers removes their window lifecycle handlers without reloading', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Window listener inspection requires Chromium CDP.')
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const cdp = await context.newCDPSession(page)
  const lifecycleListeners = async () => {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const listeners = getEventListeners(window)
        return {
          unload: (listeners.unload || []).length,
          orientationchange: (listeners.orientationchange || []).length,
        }
      })()`,
      includeCommandLineAPI: true,
      returnByValue: true,
    })
    expect(result.exceptionDetails).toBeUndefined()
    return result.result.value as { unload: number; orientationchange: number }
  }
  try {
    const baseline = await lifecycleListeners()
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'cleanup.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    })
    for (let cycle = 0; cycle < 10; cycle++) {
      await page
        .getByRole('region', { name: 'Library documents', exact: true })
        .getByRole('button', { name: 'EPUB: cleanup.epub', exact: true })
        .click()
      await page.getByRole('button', { name: 'Hide library', exact: true }).click()
      const reader = page.getByRole('region', { name: 'EPUB reader', exact: true })
      await expect(
        reader.frameLocator('iframe').getByRole('heading', { name: 'First chapter', exact: true }),
      ).toBeVisible()
      await expect.poll(lifecycleListeners).toEqual({
        unload: baseline.unload + 1,
        orientationchange: baseline.orientationchange + 1,
      })
      await page.getByRole('button', { name: 'Close cleanup.epub', exact: true }).click()
      await expect(reader).toHaveCount(0)
      await expect.poll(lifecycleListeners).toEqual(baseline)
      await page.getByRole('button', { name: 'Show library', exact: true }).click()
    }
  } finally {
    await cdp.detach()
  }
})

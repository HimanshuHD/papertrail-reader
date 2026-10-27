import { expect, test } from '@playwright/test'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const scheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test(`diagnostics keyboard and named panels at ${width}px in ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('./#/app')
      await waitForWorkspaceReady(page)
      const theme = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (scheme === 'dark') await theme.click()
      await expect(theme).toHaveAttribute('aria-pressed', String(scheme === 'dark'))
      await page.keyboard.press('Control+Alt+KeyD')
      const panel = page.getByRole('region', { name: 'Diagnostic measurements', exact: true })
      await expect(panel).toBeVisible()
      const tabs = panel.getByRole('tablist', { name: 'Diagnostic views', exact: true })
      const names = [
        'Overview',
        'Sensors',
        'Operations',
        'Resources',
        'Timeline',
        'Technical details',
      ]
      await tabs.getByRole('tab', { name: 'Overview', exact: true }).focus()
      await expect(
        panel.getByRole('tabpanel', { name: 'Overview', exact: true }).getByRole('img').first(),
      ).toHaveAttribute('aria-label', /available readings/u)
      for (const name of names) {
        const tab = tabs.getByRole('tab', { name, exact: true })
        await expect(tab).toBeFocused()
        await expect(tab).toHaveAttribute('aria-selected', 'true')
        await expect(panel.getByRole('tabpanel', { name, exact: true })).toBeVisible()
        const controlled = await tab.getAttribute('aria-controls')
        expect(controlled).toBeTruthy()
        expect(controlled).not.toMatch(/\s/u)
        await tab.press('ArrowRight')
      }
      await expect(tabs.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused()
      await page.keyboard.press('End')
      await expect(tabs.getByRole('tab', { name: 'Technical details', exact: true })).toBeFocused()
      await page.keyboard.press('Home')
      await expect(tabs.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused()
      expect(
        await panel
          .locator('header button, footer button')
          .evaluateAll((buttons) =>
            buttons.every(
              (button) => button.getAttribute('aria-label') && !button.hasAttribute('title'),
            ),
          ),
      ).toBe(true)
      const box = await panel.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Developer diagnostics', exact: true }),
      ).toBeFocused()
    })
  }
}

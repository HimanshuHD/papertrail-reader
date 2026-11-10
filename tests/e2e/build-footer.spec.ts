import { expect, test } from '@playwright/test'

for (const theme of ['Light mode', 'Dark mode']) {
  test(`build details stay reachable at narrow and short sizes in ${theme}`, async ({
    page,
  }, info) => {
    await page.goto('./#/app')
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '', { timeout: 15000 })
    const library = page.getByRole('complementary', { name: 'Document library' })
    const footer = library.getByRole('contentinfo', { name: 'Deployment information' })
    const button = footer.getByRole('button', { name: 'Build details', exact: true })
    const details = page.getByRole('region', { name: 'Build details', exact: true })
    const themeToggle = page.getByRole('button', { name: 'Dark mode', exact: true })
    if ((await themeToggle.getAttribute('aria-pressed')) !== String(theme === 'Dark mode'))
      await themeToggle.click()
    await page.getByRole('separator', { name: 'Resize library panel' }).focus()
    await page.keyboard.press('Home')
    for (const height of [900, 400]) {
      await page.setViewportSize({ width: info.project.use.viewport!.width, height })
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await Promise.all(
          document
            .getAnimations()
            .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
            .map((animation) => animation.finished.catch(() => {})),
        )
      })
      expect((await library.boundingBox())!.x).toBeGreaterThanOrEqual(0)
      expect(await page.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      )
      await expect(button).toBeInViewport()
      const diagnostics = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
      if (await diagnostics.isVisible()) {
        const buildBounds = (await button.boundingBox())!
        const triggerBounds = (await diagnostics.boundingBox())!
        expect(
          buildBounds.x + buildBounds.width <= triggerBounds.x ||
            triggerBounds.x + triggerBounds.width <= buildBounds.x ||
            buildBounds.y + buildBounds.height <= triggerBounds.y ||
            triggerBounds.y + triggerBounds.height <= buildBounds.y,
        ).toBe(true)
      }
      await button.hover()
      await expect(details).toHaveCount(0)
      await expect(button).toHaveCSS('box-shadow', 'none')
      await expect(button).toHaveCSS('border-bottom-width', '0px')
      await button.focus()
      await expect(details).toHaveCount(0)
      await button.click()
      await button.press('Tab')
      await expect(details).toBeVisible()
      const popup = (await details.locator('..').boundingBox())!
      expect(popup.width).toBeLessThanOrEqual(224)
      await expect(details.locator('..')).toHaveCSS('padding', '8px')
      expect(popup.x).toBeGreaterThanOrEqual(0)
      expect(popup.y).toBeGreaterThanOrEqual(0)
      expect(popup.x + popup.width).toBeLessThanOrEqual(page.viewportSize()!.width)
      expect(popup.y + popup.height).toBeLessThanOrEqual(height)
      await expect(details).toContainText('SHA')
      await page.screenshot({ path: info.outputPath(`build-details-${theme}-${height}.png`) })
      await page.keyboard.press('Escape')
      await expect(button).toBeFocused()
      await expect(details).toHaveCount(0)
      await expect(library).toBeVisible()
      // Click/tap opens details; outside click dismisses without hiding the library.
      await button.click()
      await expect(details).toBeVisible()
      await library.getByRole('heading', { name: 'Local Documents' }).click()
      await expect(details).toHaveCount(0)
      await button.click()
      await expect(details).toBeVisible()
      await page.getByRole('button', { name: 'Hide library', exact: true }).click()
      await expect(details).toHaveCount(0)
      await expect(footer).toHaveCount(0)
      await page.getByRole('button', { name: 'Show library', exact: true }).click()
      await expect(footer).toBeVisible()
      await expect(details).toHaveCount(0)
    }
  })
}

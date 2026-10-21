import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'
const diagnostic = process.env.E2E_DIAGNOSTICS === 'true'
test('default production cannot enable diagnostics through a query or keyboard flag', async ({
  page,
}) => {
  test.skip(diagnostic, 'Run against a default production build')
  await page.goto('./?diagnostics=true#/app')
  await waitForWorkspaceReady(page)
  await page.keyboard.press('Control+Alt+KeyD')
  await expect(
    page.getByRole('button', { name: 'Developer diagnostics', exact: true }),
  ).toHaveCount(0)
})
test('opt-in local diagnostics record PDF/EPUB, export private bounded data and stop on close', async ({
  page,
}, info) => {
  test.skip(!diagnostic, 'Explicit diagnostic build only')
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  await toggle.click()
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'private-name.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(3, undefined, true),
    },
    {
      name: 'private-name.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  for (const format of ['PDF', 'EPUB']) {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `${format}: private-name.${format.toLowerCase()}`, exact: true })
      .click()
    if (format === 'PDF')
      await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
    else await expect(page.locator('iframe')).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'pdf.open-readable',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'epub.open-readable',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'frameIntervalMs',
  )
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const file = await pending
  const json = await readFile((await file.path())!, 'utf8')
  expect(json).not.toMatch(/private-name|First chapter|\.epub|\.pdf/)
  const summary = JSON.parse(json)
  expect(summary.timings.length).toBeLessThanOrEqual(120)
  expect(summary.identity.version).toBe('2.2.0')
  expect(summary.resources.viewers).toBeGreaterThanOrEqual(1)
  await info.attach('diagnostic-summary', { body: json, contentType: 'application/json' })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset session', exact: true }).click()
  await page.getByRole('button', { name: 'Close diagnostics', exact: true }).click()
  await expect(toggle).toBeFocused()
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('reader profiles keep configuration and retained evidence separate in the real panel', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  await toggle.click()
  await page.getByRole('tab', { name: 'Resources', exact: true }).click()
  await page.getByRole('button', { name: 'Mark baseline', exact: true }).click()
  await page.getByRole('tab', { name: 'Technical details', exact: true }).click()
  const form = page.locator('form').filter({
    has: page.getByRole('heading', { name: 'Local provisional operation targets', exact: true }),
  })
  await form.getByLabel('Operation', { exact: true }).selectOption('pdf.warm-activate')
  await expect(form.getByLabel('Attention (ms)', { exact: true })).toHaveValue('')
  await form.getByLabel('Attention (ms)', { exact: true }).fill('200')
  await form.getByLabel('Critical (ms)', { exact: true }).fill('1000')
  await form.getByRole('button', { name: 'Apply provisional target', exact: true }).click()
  await expect(form).toContainText('Configured: attention 200 ms')
  await form.getByLabel('Operation', { exact: true }).selectOption('pdf.cold-open')
  await form.getByLabel('Rule', { exact: true }).selectOption('pending')
  await expect(form.getByLabel('Attention (ms)', { exact: true })).toHaveValue('')
  await form.getByLabel('Attention (ms)', { exact: true }).fill('10000')
  await form.getByLabel('Critical (ms)', { exact: true }).fill('300000')
  await form.getByRole('button', { name: 'Apply provisional target', exact: true }).click()
  await form.getByLabel('Operation', { exact: true }).selectOption('pdf.warm-activate')
  await form.getByLabel('Rule', { exact: true }).selectOption('operations')
  await expect(form.getByLabel('Attention (ms)', { exact: true })).toHaveValue('200')
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'private-profile.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    {
      name: 'private-profile.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  for (const format of ['PDF', 'EPUB']) {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    const entry = page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', {
        name: `${format}: private-profile.${format.toLowerCase()}`,
        exact: true,
      })
    await entry.click()
    await expect(entry).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    if (format === 'PDF')
      await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
        'aria-busy',
        'false',
      )
    else
      await expect(
        page
          .locator('.epub-reader:visible')
          .frameLocator('iframe')
          .getByRole('heading', { name: 'First chapter', exact: true }),
      ).toBeVisible()
  }
  for (let i = 0; i < 3; i++) {
    await page.getByRole('tab', { name: /PDF: private-profile.pdf/ }).click()
    await page.getByRole('tab', { name: /EPUB: private-profile.epub/ }).click()
  }
  await toggle.click()
  await page.getByRole('tab', { name: 'Operations', exact: true }).click()
  const profiles = page.getByRole('region', { name: 'Reader lifecycle profiles', exact: true })
  await expect(profiles).toContainText('PDF warm selection dispatch')
  await expect(profiles).toContainText('Duration configured')
  await expect(profiles).toContainText('Pending age configured')
  await expect(profiles.locator('tbody tr')).toHaveCount(8)
  await page.getByRole('tab', { name: 'Resources', exact: true }).click()
  await expect(page.getByLabel('Resource investigation notes', { exact: true })).toContainText(
    'informational',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const file = await download
  const json = await readFile((await file.path())!, 'utf8'),
    data = JSON.parse(json)
  expect(data.indicators.configuration.version).toBe(2)
  expect(data.indicators.configuration.operations['pdf.warm-activate']).toEqual({
    attentionMs: 200,
    criticalMs: 1000,
  })
  expect(data.indicators.configuration.operations['pdf.cold-open']).toBeUndefined()
  expect(data.indicators.configuration.pending['pdf.cold-open']).toEqual({
    attentionMs: 10000,
    criticalMs: 300000,
  })
  expect(
    data.resourceInvestigation.timings.filter(
      (r: { operation: string; outcome: string }) =>
        r.operation === 'pdf.warm-activate' && r.outcome === 'completed',
    ).length,
  ).toBeGreaterThanOrEqual(3)
  expect(
    data.resourceInvestigation.observations.some((r: { key: string }) => r.key === 'viewers'),
  ).toBe(true)
  expect(json).not.toMatch(/private-profile|First chapter|reader-session-/)
  await info.attach('profile-configuration-evidence', {
    body: json,
    contentType: 'application/json',
  })
})

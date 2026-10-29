import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test.use({ trace: 'retain-on-failure' })

test('repeated mixed-reader cleanup returns instrumented registrations to baseline', async ({
  page,
}, info) => {
  // Three real open/close cycles and repeated downloads share one functional case.
  test.setTimeout(120000)
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  const exportSummary = async () => {
    const download = page.waitForEvent('download', { timeout: 15000 })
    await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
    const file = await download
    return JSON.parse(await readFile((await file.path())!, 'utf8'))
  }
  await toggle.click()
  await page.getByRole('tab', { name: 'Resources', exact: true }).click()
  await page.getByRole('button', { name: 'Mark baseline', exact: true }).click()
  await page.getByRole('button', { name: 'Measure page memory', exact: true }).click()
  // These normal acceptance servers are intentionally not cross-origin isolated.
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'cross-origin isolation required',
  )
  const baseline = (await exportSummary()).resources
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'private-cleanup.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(3) },
    {
      name: 'private-cleanup.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
  ])
  const audits: { cycle: number; resources: Record<string, number>; releaseTimings: unknown[] }[] =
    []
  for (let cycle = 0; cycle < 3; cycle++) {
    await test.step(`Mixed-reader cleanup cycle ${cycle + 1}`, async () => {
      for (const format of ['PDF', 'EPUB']) {
        const show = page.getByRole('button', { name: 'Show library', exact: true })
        if (await show.isVisible()) await show.click()
        const entry = page
          .getByRole('region', { name: 'Library documents', exact: true })
          .getByRole('button', {
            name: `${format}: private-cleanup.${format.toLowerCase()}`,
            exact: true,
          })
        await entry.click()
        await expect(entry).toHaveAttribute('aria-pressed', 'true')
        await page.getByRole('button', { name: 'Hide library', exact: true }).click()
        if (format === 'PDF')
          await expect(
            page.getByRole('region', { name: 'PDF pages', exact: true }),
          ).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
        else
          await expect(
            page
              .locator('.epub-reader:visible')
              .frameLocator('iframe')
              .getByRole('heading', { name: 'First chapter', exact: true }),
          ).toBeVisible()
      }
      await toggle.click()
      const open = await exportSummary()
      expect(open.resources.ownedListeners).toBeGreaterThan(baseline.ownedListeners ?? 0)
      expect(open.resources.ownedObservers).toBeGreaterThan(baseline.ownedObservers ?? 0)
      expect(open.resources.ownedTimers).toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Close private-cleanup.pdf', exact: true }).click()
      await page.getByRole('button', { name: 'Close private-cleanup.epub', exact: true }).click()
      let settled: typeof open
      await expect
        .poll(
          async () => {
            settled = await exportSummary()
            return [
              'viewers',
              'pdfWorkerOwners',
              'blobURLs',
              'ownedListeners',
              'ownedObservers',
              'ownedTimers',
            ].map((key) => (settled.resources[key] ?? 0) - (baseline[key] ?? 0))
          },
          {
            timeout: 15000,
            message: `Owned resources must return to baseline after cleanup cycle ${cycle + 1}`,
          },
        )
        .toEqual([0, 0, 0, 0, 0, 0])
      for (const operation of ['pdf.reader-release', 'epub.reader-release'])
        expect(
          settled!.resourceInvestigation.timings.some(
            (row: { operation: string; outcome: string }) =>
              row.operation === operation && row.outcome === 'completed',
          ),
        ).toBe(true)
      audits.push({
        cycle: cycle + 1,
        resources: settled!.resources,
        releaseTimings: settled!.resourceInvestigation.timings.filter(
          (row: { operation: string }) => row.operation.endsWith('reader-release'),
        ),
      })
      expect(JSON.stringify(settled!)).not.toMatch(/private-cleanup|First chapter|reader-session-/)
      await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
    })
  }
  await info.attach('cleanup-cycles', {
    body: JSON.stringify({ baseline, cycles: audits }),
    contentType: 'application/json',
  })
})

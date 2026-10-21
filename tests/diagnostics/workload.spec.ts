import { expect, test } from '@playwright/test'
import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createFormattedEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('compare identical mixed-reader workloads across production and diagnostic modes', async ({
  browser,
  browserName,
}, info) => {
  const trials = Number(process.env.DIAGNOSTIC_TRIALS || 3)
  test.setTimeout(Math.max(180000, trials * 4 * 20000))
  const results: object[] = []
  const pdf = createPdfFixture(12),
    epub = Buffer.from(createFormattedEpubFixture())
  const modes = ['production', 'closed', 'sampling', 'paused'] as const
  for (let trial = 0; trial < trials; trial++) {
    // Rotate the order to reduce systematic warm-up/thermal ordering bias.
    const order = modes.map((_, index) => modes[(index + trial) % modes.length]!)
    for (const mode of order) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      })
      try {
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.name))
        await page.goto(
          `http://127.0.0.1:${mode === 'production' ? 4176 : 4177}/?diagnostics=true#/app`,
        )
        await waitForWorkspaceReady(page)
        const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
        if (mode === 'production') {
          await page.keyboard.press('Control+Alt+KeyD')
          await expect(toggle).toHaveCount(0)
        } else {
          await expect(toggle).toBeVisible()
          if (mode === 'sampling' || mode === 'paused') {
            await toggle.click()
            if (mode === 'paused')
              await page.getByRole('button', { name: 'Pause', exact: true }).click()
            await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
          }
        }
        const stages: Record<string, number> = {}
        const timed = async (name: string, action: () => Promise<void>) => {
          const start = performance.now()
          await action()
          stages[name] = performance.now() - start
        }
        const started = performance.now()
        await timed('fileInjectionAndListing', async () => {
          await page.locator('input[accept*=".pdf"]').setInputFiles([
            { name: 'acceptance.pdf', mimeType: 'application/pdf', buffer: pdf },
            { name: 'acceptance.epub', mimeType: 'application/epub+zip', buffer: epub },
          ])
          await expect(
            page.getByRole('button', { name: 'PDF: acceptance.pdf', exact: true }),
          ).toBeVisible()
        })
        const open = async (name: string) => {
          const show = page.getByRole('button', { name: 'Show library', exact: true })
          if (await show.isVisible()) await show.click()
          await page
            .getByRole('region', { name: 'Library documents', exact: true })
            .getByRole('button', { name, exact: true })
            .click()
          await page.getByRole('button', { name: 'Hide library', exact: true }).click()
        }
        await timed('pdfOpen', async () => {
          await open('PDF: acceptance.pdf')
          await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
            'data-render-state',
            'ready',
          )
        })
        await timed('pdfDistantNavigation', async () => {
          const input = page.getByRole('spinbutton', { name: 'Current page', exact: true })
          await input.fill('12')
          await input.press('Tab')
          await expect(page.locator('[data-pdf-page="12"]')).toHaveAttribute(
            'data-render-state',
            'ready',
          )
        })
        await timed('epubOpen', async () => {
          await open('EPUB: acceptance.epub')
          await expect(
            page
              .locator('.epub-reader:visible')
              .frameLocator('iframe')
              .getByRole('heading', { name: 'Formatted chapter', exact: true }),
          ).toBeVisible()
        })
        await timed('warmSwitches', async () => {
          for (let index = 0; index < 3; index++) {
            await page.getByRole('tab', { name: /PDF: acceptance.pdf/ }).click()
            await expect(
              page.getByRole('spinbutton', { name: 'Current page', exact: true }),
            ).toHaveValue('12')
            await expect(
              page.locator('.session-panel:not(.session-inactive) .loading-card'),
            ).toHaveCount(0)
            await page.getByRole('tab', { name: /EPUB: acceptance.epub/ }).click()
            await expect(
              page
                .locator('.epub-reader:visible')
                .frameLocator('iframe')
                .getByRole('heading', { name: 'Formatted chapter', exact: true }),
            ).toBeVisible()
            await expect(
              page.locator('.session-panel:not(.session-inactive) .loading-card'),
            ).toHaveCount(0)
          }
        })
        await timed('closeBoth', async () => {
          await page.getByRole('button', { name: 'Close acceptance.pdf', exact: true }).click()
          await page.getByRole('button', { name: 'Close acceptance.epub', exact: true }).click()
          await expect(page.locator('.pdf-reader, .epub-reader')).toHaveCount(0)
        })
        const elapsedMs = performance.now() - started
        expect(errors).toEqual([])
        let diagnostics = null
        if (mode === 'sampling' || mode === 'paused') {
          await toggle.click()
          const pending = page.waitForEvent('download')
          await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
          const download = await pending
          const text = await readFile((await download.path())!, 'utf8')
          expect(text).not.toMatch(/acceptance\.(pdf|epub)|Formatted chapter|Author formatting/)
          const evidence = JSON.parse(text)
          expect(evidence.running).toBe(mode === 'sampling')
          expect(evidence.identity.sourceSha).toBe(process.env.DIAGNOSTIC_EXPECTED_SHA)
          diagnostics = {
            running: evidence.running,
            retainedSamples: evidence.samples.length,
            samplerCallbackSubset: evidence.samplerOverhead,
          }
        }
        results.push({
          engine: browserName,
          browserVersion: browser.version(),
          trial: trial + 1,
          mode,
          elapsedMs,
          stages,
          diagnostics,
          fixture: { pdfPages: 12, pdfBytes: pdf.length, epubBytes: epub.length },
          viewport: { width: 1440, height: 900 },
          cache: 'Fresh context; first open plus retained warm switches; OS cache uncontrolled',
          sensors: 'Additional sensors off; base diagnostics only',
        })
      } finally {
        await context.close()
      }
    }
  }
  await info.attach('diagnostic-workload-trials', {
    body: Buffer.from(JSON.stringify(results)),
    contentType: 'application/json',
  })
})

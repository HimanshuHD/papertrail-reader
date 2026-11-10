import { expect, test } from '@playwright/test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { IndicatorMonitor } from '../../src/features/diagnostics/indicators'
import { profileTimings } from '../../src/features/diagnostics/operation-profiles'
import { waitForWorkspaceReady } from '../fixtures/browser'
import { createPdfFixture } from '../fixtures/pdf'
import { createFormattedEpubFixture } from '../fixtures/epub'
import {
  fixtureBrowser,
  fixtureTargetConfiguration,
  fixtureTargets,
  fixtureTargetVersion,
  type TargetFixture,
} from '../fixtures/scoped-performance-targets'

test.skip(
  ({ browserName }) =>
    process.env.DIAGNOSTIC_FIXTURE_TARGETS !== 'true' || browserName !== 'chromium',
  'Opt-in Chromium fixture target review',
)

test.use({
  viewport: { width: fixtureBrowser.width, height: fixtureBrowser.height },
  reducedMotion: fixtureBrowser.reducedMotion,
  headless: true,
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: [
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})

for (const fixture of Object.keys(fixtureTargets) as TargetFixture[]) {
  test(`evaluates the scoped target with a real ${fixture} export`, async ({
    page,
    browser,
    browserName,
  }, info) => {
    const scope = {
      ...fixtureBrowser,
      fixture,
      engine: browserName,
      version: browser.version(),
      platform: process.platform,
      ...page.viewportSize()!,
    }
    const config = fixtureTargetConfiguration(scope)
    test.skip(config === null, 'Target reference requires the calibrated Chromium build and scope')
    if (!config) throw new Error('Fixture target scope was not matched')

    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
    await toggle.click()
    await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()

    if (fixture === 'directory-1000') {
      const folder = await mkdtemp(path.join(os.tmpdir(), 'papertrail-fixture-target-'))
      try {
        const bytes = createPdfFixture(2)
        for (let i = 0; i < 1000; i++)
          await writeFile(path.join(folder, `generated-${i}.pdf`), bytes)
        await page.locator('input[webkitdirectory]').setInputFiles(folder)
        const list = page.getByRole('region', { name: 'Library documents', exact: true })
        await expect(list.getByRole('button', { name: /^PDF: generated-/ })).toHaveCount(1000)
        await expect(list).toHaveAttribute('aria-busy', 'false')
      } finally {
        await rm(folder, { recursive: true, force: true })
      }
    } else {
      const pdf = fixture === 'text-pdf-1001'
      const name = pdf ? 'generated.pdf' : 'generated.epub'
      await page.locator('input[accept*=".pdf"]').setInputFiles({
        name,
        mimeType: pdf ? 'application/pdf' : 'application/epub+zip',
        buffer: pdf ? createPdfFixture(1001) : Buffer.from(createFormattedEpubFixture(1000)),
      })
      await page
        .getByRole('button', { name: `${pdf ? 'PDF' : 'EPUB'}: ${name}`, exact: true })
        .click()
      if (pdf) {
        await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
          'aria-busy',
          'false',
        )
        await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
          'data-render-state',
          'ready',
        )
      } else {
        const frame = page
          .getByRole('region', { name: 'EPUB reader', exact: true })
          .frameLocator('iframe')
        await expect(
          frame.getByRole('heading', { name: 'Formatted chapter', exact: true }),
        ).toBeVisible()
        await expect(
          frame.getByRole('img', { name: 'Local illustration', exact: true }),
        ).toBeVisible()
      }
    }

    const observed = await page.evaluate(() => ({
      now: performance.now(),
      foreground: document.visibilityState === 'visible',
    }))
    expect(observed.foreground).toBe(true)
    await toggle.click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
    const data = JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
    expect(process.env.DIAGNOSTIC_EXPECTED_SHA).toMatch(/^[a-f0-9]{40}$/)
    expect(data.identity.sourceSha).toBe(process.env.DIAGNOSTIC_EXPECTED_SHA)
    expect(data.running).toBe(true)
    expect(data.responsiveness.active).toBe(false)
    const { profile } = fixtureTargets[fixture]
    const timings = profileTimings(data, data.resourceInvestigation).filter(
      (row) => row.metric === profile && row.outcome === 'completed',
    )
    expect(timings).toHaveLength(1)
    expect(timings[0]!.endedAtMs).toBeLessThanOrEqual(observed.now)
    const durationMs = timings[0]!.durationMs
    expect(Number.isFinite(durationMs) && durationMs >= 0).toBe(true)

    const monitor = new IndicatorMonitor(config)
    const result = monitor.update(
      data,
      observed.now,
      observed.foreground,
      data.resourceInvestigation,
    )
    // A single real observation cannot trigger a sustained operation finding.
    expect(result.findings.some((finding) => finding.id === profile)).toBe(false)
    await info.attach('scoped-target-review', {
      body: JSON.stringify({
        version: fixtureTargetVersion,
        scope,
        sourceSha: data.identity.sourceSha,
        profile,
        durationMs,
        configuration: monitor.config,
        operationFindings: result.findings.filter((finding) => finding.id === profile),
      }),
      contentType: 'application/json',
    })
  })
}

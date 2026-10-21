import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady } from '../fixtures/browser'
const diagnostic =
  process.env.E2E_DIAGNOSTICS === 'true' ||
  ['preview', 'staging'].includes(process.env.E2E_DEPLOY_CHANNEL ?? '')
test('default production cannot enable diagnostics through a query or keyboard flag', async ({
  page,
}) => {
  test.skip(diagnostic, 'Run against a default production build')
  await page.goto('./?diagnostics=true#/app')
  await waitForWorkspaceReady(page, process.env.E2E_DEPLOY_CHANNEL === 'preview' ? 15000 : 5000)
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
  await waitForWorkspaceReady(page, process.env.E2E_DEPLOY_CHANNEL === 'preview' ? 15000 : 5000)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  await toggle.click()
  await page.getByRole('tab', { name: 'Resources', exact: true }).click()
  await page.getByRole('button', { name: 'Mark baseline', exact: true }).click()
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
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
    const hideLibrary = page.getByRole('button', { name: 'Hide library', exact: true })
    if (await hideLibrary.isVisible()) await hideLibrary.click()
    if (format === 'PDF') {
      await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
      await page.getByRole('button', { name: 'Next page', exact: true }).click()
      await expect(page.locator('[data-pdf-page="2"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
    } else {
      await expect(page.locator('iframe')).toBeVisible()
      await page.getByRole('button', { name: 'Next chapter', exact: true }).click()
      await expect(
        page.frameLocator('iframe').getByRole('heading', { name: 'Second chapter', exact: true }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Typography', exact: true }).click()
      await page.getByRole('button', { name: 'Increase font size', exact: true }).click()
      await page.getByRole('button', { name: 'Close typography', exact: true }).click()
    }
  }
  await toggle.click()
  await page.getByRole('tab', { name: 'Operations', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Operations', exact: true })).toHaveCSS(
    'background-color',
    'rgb(35, 104, 107)',
  )
  await expect(page.getByRole('tablist', { name: 'Diagnostic views' })).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'pdf.open-readable',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'epub.open-readable',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'epub.chapter',
  )
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'epub.reflow',
  )
  await page.getByRole('tab', { name: 'Technical details', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toContainText(
    'frameIntervalMs',
  )
  await page.getByRole('tab', { name: /private-name.pdf/ }).click()
  await expect(
    page.locator('.session-panel:not(.session-inactive) [data-pdf-page="2"]'),
  ).toHaveAttribute('data-render-state', 'ready')
  await page.getByRole('tab', { name: /private-name.epub/ }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const file = await pending
  const json = await readFile((await file.path())!, 'utf8')
  expect(json).not.toMatch(/private-name|First chapter|\.epub|\.pdf/)
  const summary = JSON.parse(json)
  expect(summary.timings.length).toBeLessThanOrEqual(120)
  expect(summary.identity.version).toBe('2.2.0')
  expect(summary.resources.viewers).toBeGreaterThanOrEqual(1)
  expect(summary.resourceInvestigation.baseline.resources.viewers).toBe(0)
  expect(
    summary.resourceInvestigation.timings.some(
      (row: { operation: string }) => row.operation === 'pdf.render-request',
    ),
  ).toBe(true)
  expect(
    summary.resourceInvestigation.timings.some(
      (row: { operation: string }) => row.operation === 'reading.transaction',
    ),
  ).toBe(true)
  expect(
    summary.resourceInvestigation.caches.dimensions.hits +
      summary.resourceInvestigation.caches.dimensions.misses,
  ).toBeGreaterThan(0)
  await info.attach('diagnostic-summary', { body: json, contentType: 'application/json' })
  await page.getByRole('button', { name: 'Close private-name.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Close private-name.epub', exact: true }).click()
  // PDF metadata/preview workers can finish asynchronously after the reader closes.
  // Poll the live exported recorder, rather than a one-second-old rendered snapshot.
  await expect
    .poll(
      async () => {
        const closedDownload = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
        const closedFile = await closedDownload
        const closed = JSON.parse(await readFile((await closedFile.path())!, 'utf8'))
        return {
          viewers: closed.resources.viewers ?? 0,
          workers: closed.resources.pdfWorkerOwners ?? 0,
          blobs: closed.resources.blobURLs ?? 0,
        }
      },
      { timeout: 15000 },
    )
    .toEqual({ viewers: 0, workers: 0, blobs: 0 })
  await page.getByRole('tab', { name: 'Resources', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Resource investigation', exact: true }),
  ).toContainText('Selected owner counts match the baseline')
  const resourceRegion = page.getByRole('region', { name: 'Resource investigation', exact: true })
  await info.attach('resources-cleanup', {
    body: await resourceRegion.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('tab', { name: 'Cleanup', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Caches', exact: true })).toBeFocused()
  await expect(resourceRegion).toContainText('Is cached PDF work being reused?')
  await info.attach('resources-caches', {
    body: await resourceRegion.screenshot(),
    contentType: 'image/png',
  })
  await page.keyboard.press('ArrowRight')
  await expect(resourceRegion).toContainText('Where is the request taking time?')
  await info.attach('resources-requests', {
    body: await resourceRegion.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  await toggle.click()
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('tab', { name: 'Storage', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh estimate', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Resource investigation', exact: true }),
  ).toContainText(/Origin storage estimate; disk usage|Unavailable: /)
  await info.attach('resource-baseline', {
    body: await page
      .getByRole('region', { name: 'Diagnostic measurements', exact: true })
      .screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset session', exact: true }).click()
  await page.getByRole('button', { name: 'Close diagnostics', exact: true }).click()
  await expect(toggle).toBeFocused()
  await expect(page.getByRole('region', { name: 'Diagnostic measurements' })).toHaveCount(0)
})

test('diagnostic dashboard remains readable and keyboard accessible at mobile width in dark mode', async ({
  page,
}, info) => {
  test.skip(!diagnostic, 'Explicit diagnostic build only')
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page, process.env.E2E_DEPLOY_CHANNEL === 'preview' ? 15000 : 5000)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Developer diagnostics', exact: true }).click()
  const region = page.getByRole('region', { name: 'Diagnostic measurements' })
  await expect(region).toContainText('Targets not configured')
  const header = region.locator('header')
  await expect(header.getByRole('button')).toHaveCount(3)
  await expect(region.locator('footer').getByRole('button')).toHaveCount(2)
  await expect(region.locator('button[title]')).toHaveCount(0)
  const pause = header.getByRole('button', { name: 'Pause', exact: true })
  await pause.focus()
  await expect(page.getByRole('tooltip', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByRole('tooltip')).toHaveCount(1)
  await header.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  const trigger = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  const triggerBounds = await trigger.boundingBox()
  expect(Math.round(triggerBounds!.y + triggerBounds!.height)).toBe(900)
  await expect(trigger.locator('.pulse-loader')).toHaveAttribute(
    'data-state',
    /recording|collecting/,
  )
  await trigger.click()
  await region.getByRole('button', { name: 'Pause', exact: true }).click()
  await region.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  await expect(trigger.locator('.pulse-loader')).toHaveAttribute('data-state', 'inactive')
  await expect(trigger.locator('.pulse-ring').first()).toHaveCSS('animation-name', 'none')
  await info.attach('diagnostics-minimized-paused', {
    body: await trigger.screenshot(),
    contentType: 'image/png',
  })
  await trigger.click()
  const overview = region.getByRole('tab', { name: 'Overview', exact: true })
  await overview.focus()
  await page.keyboard.press('ArrowRight')
  await expect(region.getByRole('tab', { name: 'Sensors', exact: true })).toBeFocused()
  await expect(region.getByRole('tabpanel', { name: 'Sensors', exact: true })).toBeVisible()
  await page.keyboard.press('End')
  await expect(region.getByRole('tab', { name: 'Technical details', exact: true })).toBeFocused()
  await region.getByRole('tab', { name: 'Timeline', exact: true }).click()
  await expect(region.getByRole('tab', { name: 'Timeline', exact: true })).toHaveCSS(
    'background-color',
    'rgb(40, 90, 96)',
  )
  await expect(region.getByRole('tab', { name: 'Timeline', exact: true })).toHaveCSS(
    'box-shadow',
    'none',
  )
  await expect(region.getByRole('tablist')).toHaveCSS('border-top-width', '1px')
  await expect(region.getByRole('tablist')).toHaveCSS('border-bottom-width', '1px')
  await expect(region).toContainText('Session timeline')
  for (const label of ['All events', 'Incidents only', 'Transitions only'])
    await expect(region.getByRole('button', { name: label, exact: true })).toBeVisible()
  await region.getByRole('button', { name: 'Incidents only', exact: true }).click()
  await expect(region).toContainText('No retained performance incidents')
  await region.getByRole('button', { name: 'Transitions only', exact: true }).click()
  await expect(region.getByRole('list', { name: 'Chronological diagnostic events' })).toBeVisible()
  await region.getByRole('tab', { name: 'Resources', exact: true }).click()
  await expect(region.getByRole('tabpanel', { name: 'Resources', exact: true })).toContainText(
    'No registered owner',
  )
  await info.attach('resources-320-dark', {
    body: await region.screenshot(),
    contentType: 'image/png',
  })
  const bounds = await region.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await region.getByRole('tab', { name: 'Overview', exact: true }).click()
  await info.attach('dashboard-320-dark', {
    body: await region.screenshot(),
    contentType: 'image/png',
  })
  await page.keyboard.press('Escape')
  await expect(region).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Developer diagnostics', exact: true }),
  ).toBeFocused()
})

test('additional diagnostic sensors are opt-in and export private real browser observations', async ({
  page,
}, info) => {
  test.skip(!diagnostic, 'Diagnostic build only')
  await page.goto('./#/app')
  await waitForWorkspaceReady(page, process.env.E2E_DEPLOY_CHANNEL === 'preview' ? 15000 : 5000)
  const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
  await toggle.click()
  await page.getByRole('tab', { name: 'Sensors', exact: true }).click()
  const enabled = page.getByRole('checkbox', {
    name: 'Capture sensors',
    exact: true,
  })
  await expect(enabled).not.toBeChecked()
  await enabled.check()
  await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
  // Controlled slow input fixture; the application observes timing, never this text or DOM target.
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.id = 'sensor-work'
    button.textContent = 'PRIVATE_SENSOR_FIXTURE'
    button.style.cssText = 'position:fixed;top:4px;left:4px;z-index:9999'
    button.onclick = () => {
      const end = performance.now() + 75
      while (performance.now() < end) {
        /* Controlled main-thread load for observer coverage. */
      }
    }
    document.body.append(button)
  })
  for (let i = 0; i < 3; i++) await page.locator('#sensor-work').click()
  await page.evaluate(async () => {
    await fetch(location.href, { cache: 'no-store' })
    document.getElementById('sensor-work')?.remove()
  })
  await toggle.click()
  const sensors = page.getByRole('region', {
    name: 'Responsiveness and loading sensors',
    exact: true,
  })
  await expect(sensors).toContainText(/[1-9]\d* retained observations/)
  await expect(sensors).toHaveCSS('max-height', 'none')
  await expect(sensors).toHaveCSS('overflow', 'visible')
  await expect(sensors).toContainText('Not page INP')
  await sensors.getByText('How to read this / captured evidence', { exact: true }).click()
  await expect(sensors).toContainText('Requested event duration ≥ 16 ms')
  await sensors.getByRole('tab', { name: 'Long frames', exact: true }).click()
  await expect(sensors).toContainText(/[1-9]\d* retained observations/)
  await expect(sensors).toContainText('Phases overlap')
  await sensors.getByText('How to read this / captured evidence', { exact: true }).click()
  await expect(sensors).toContainText('Event / callback / other')
  await sensors.getByRole('tab', { name: 'Loading', exact: true }).click()
  await expect(sensors).toContainText(/[1-9]\d* retained observations/)
  await sensors.getByText('How to read this / captured evidence', { exact: true }).click()
  await expect(sensors).toContainText('Zero transfer can mean cache')
  await sensors.getByRole('tab', { name: 'Inputs', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(sensors.getByRole('tab', { name: 'Loading', exact: true })).toBeFocused()
  await sensors.getByRole('tab', { name: 'Inputs', exact: true }).click()
  await info.attach('responsiveness-sensors', {
    body: await sensors.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const downloaded = await downloading
  const text = await readFile((await downloaded.path())!, 'utf8')
  const summary = JSON.parse(text)
  expect(summary.responsiveness.active).toBe(false)
  expect(summary.responsiveness.inputs.length).toBeGreaterThan(0)
  expect(summary.responsiveness.frames.length).toBeGreaterThan(0)
  expect(summary.responsiveness.resources.length).toBeGreaterThan(0)
  expect(text).not.toContain('PRIVATE_SENSOR_FIXTURE')
  expect(text).not.toMatch(/sourceURL|sourceFunctionName|interactionId|initiatorType/)
  await page.getByRole('button', { name: 'Reset session', exact: true }).click()
  await expect(sensors).toContainText('0 retained observations')
  await page.getByRole('button', { name: 'Close diagnostics', exact: true }).click()
})

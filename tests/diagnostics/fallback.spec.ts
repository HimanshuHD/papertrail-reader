import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { waitForWorkspaceReady } from '../fixtures/browser'

test('missing observer APIs show unavailable evidence rather than fabricated zero readings', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'PerformanceObserver', { value: undefined, configurable: true })
  })
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.getByRole('button', { name: 'Developer diagnostics', exact: true }).click()
  await page.getByRole('tab', { name: 'Sensors', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Capture sensors', exact: true }).check()
  const sensors = page.getByRole('region', {
    name: 'Responsiveness and loading sensors',
    exact: true,
  })
  for (const name of ['Inputs', 'Long frames', 'Loading']) {
    await sensors.getByRole('tab', { name, exact: true }).click()
    await expect(sensors).toContainText('Unavailable: browser does not advertise this entry type')
    await expect(sensors.locator('.headline')).toHaveText('Unavailable')
    await expect(sensors).toContainText('0 retained observations')
  }
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
  const download = await pending
  const summary = JSON.parse(await readFile((await download.path())!, 'utf8'))
  for (const key of ['inputs', 'frames', 'resources'])
    expect(summary.responsiveness[key]).toEqual([])
  for (const value of Object.values(summary.responsiveness.capabilities))
    expect(value).toMatch(/^Unavailable:/)
})

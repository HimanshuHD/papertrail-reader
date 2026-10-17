import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

// No browser or new snapshots: compare the two retained captures under the existing pixel policy.
for (const state of [
  'loading',
  'loading-reduced',
  'ready',
  'library-hidden',
  'error',
  'retry-ready',
]) {
  test(`unchanged-content stability: ${state}`, async ({ browserName }, info) => {
    test.skip(
      !process.env.VISUAL_STABILITY_REFERENCE,
      'Only the explicit diagnostic runs this check',
    )
    expect(browserName).toBe('chromium')
    const folder = process.env.VISUAL_STABILITY_ACTUAL
    expect(folder, 'Actual repeat capture directory is required').toBeTruthy()
    const bytes = await fs.readFile(path.join(folder!, info.project.name, `${state}.png`))
    expect(bytes).toMatchSnapshot(`${state}.png`, { threshold: 0.15, maxDiffPixels: 20 })
  })
}

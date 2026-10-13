import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
const approval = JSON.parse(await fs.readFile('tests/visual/baselines/approval.json', 'utf8'))
for (const state of [
  'loading',
  'loading-reduced',
  'ready',
  'library-hidden',
  'error',
  'retry-ready',
]) {
  test(`approved visual regression: ${state}`, async ({ browserName }, info) => {
    test.skip(!approval.enabled, 'No approved baseline')
    expect(browserName).toBe('chromium')
    const file = `${info.project.name}/${state}.png`
    expect(approval.files[file], `Missing approved baseline: ${file}`).toBeTruthy()
    const identity = JSON.parse(
      await fs.readFile(path.join('visual-evidence', file.replace('.png', '.json')), 'utf8'),
    )
    expect(identity.browser).toBe(approval.environment.browserVersion)
    const bytes = await fs.readFile(path.join('visual-evidence', file))
    expect(bytes).toMatchSnapshot(`${state}.png`, { threshold: 0.15, maxDiffPixels: 20 })
  })
}

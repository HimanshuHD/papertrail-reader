import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chromium' })
try {
  await mkdir('browser-evidence', { recursive: true })
  await writeFile(
    'browser-evidence/environment.json',
    JSON.stringify(
      {
        candidateSource: process.env.E2E_SOURCE_SHA,
        testedCheckout: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        run: process.env.GITHUB_RUN_ID,
        platform: process.platform,
        node: process.version,
        chromium: browser.version(),
        capturedAt: new Date().toISOString(),
        scope:
          'Headless Linux Chromium; viewport emulation does not certify real devices or other browser products.',
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
}

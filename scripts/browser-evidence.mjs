import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { chromium, firefox, webkit } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chromium' })
const versions = { chromium: browser.version() }
for (const [name, engine] of Object.entries({ firefox, webkit })) {
  const instance = await engine.launch()
  try {
    versions[name] = instance.version()
  } finally {
    await instance.close()
  }
}
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
        engines: versions,
        capturedAt: new Date().toISOString(),
        scope:
          'Headless Linux Chromium full suite and Firefox/WebKit smoke subset; viewport emulation does not certify devices, installed Chrome/Edge or macOS Safari.',
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
}

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
        shard: process.env.E2E_SHARD,
        platform: process.platform,
        node: process.version,
        chromium: browser.version(),
        engines: versions,
        capturedAt: new Date().toISOString(),
        scope:
          'Linux Chromium full suite (headed native tab-focus under Xvfb; other cases headless), Firefox/WebKit smoke subset. Viewport emulation does not certify devices, installed Chrome/Edge or macOS Safari.',
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const url = 'https://himanshuhd.github.io/papertrail-reader/preview/pr-207/'
const source = '130956d5567635c3e40b981b2145074e2a152bd1'
await fs.mkdir('live-draft-evidence', { recursive: true })
const response = await fetch(url + 'channel.json', { cache: 'no-store' })
assert.equal(response.status, 200)
assert.equal((await response.json()).draft, true)
const browser = await chromium.launch()
const page = await browser.newPage()
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  const footer = page.getByRole('contentinfo', { name: 'Deployment information' })
  await footer.getByText('Published revision · PR currently draft', { exact: true }).waitFor({ timeout: 20000 })
  assert.equal(await footer.getByRole('link', { name: 'PR #207', exact: true }).count(), 1)
  assert.equal(await footer.getByRole('link', { name: source.slice(0, 7), exact: true }).getAttribute('href'), 'https://github.com/HimanshuHD/papertrail-reader/commit/' + source)
  await page.screenshot({ path: 'live-draft-evidence/draft-notice.png', fullPage: true })
  await fs.writeFile('live-draft-evidence/status.json', JSON.stringify({ url, source, draft: true, renderedNotice: 'pass', verifiedAt: new Date().toISOString() }, null, 2))
  console.log('LIVE DRAFT NOTICE PASS: exact published PR/source and rendered notice verified')
} finally {
  await browser.close()
}

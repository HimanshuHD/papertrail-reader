import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const roots = process.argv.slice(2)
if (roots.length !== 2) throw new Error('Provide baseline and release worktree folders')
const output = 'startup-measurement'
await mkdir(output, { recursive: true })
const media = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.json': 'application/json',
}
const servers = []
for (const root of roots) {
  const dist = path.resolve(root, 'dist')
  const server = createServer(async (req, res) => {
    try {
      const relative =
        decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') ||
        'index.html'
      const file = path.resolve(dist, relative)
      if (!file.startsWith(dist + path.sep)) throw new Error('Invalid path')
      const bytes = await readFile(file)
      res.writeHead(200, {
        'content-type': media[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      res.end(bytes)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
}
const browser = await chromium.launch()
const results = {
  schema: 1,
  browser: browser.version(),
  platform: process.platform,
  repetitions: 5,
  boundary:
    'Empty-library reader shell is visible and no inert ancestor blocks its Add local documents control; excludes document reopen and preview hold.',
  identities: roots.map((root) => ({
    sha: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    version: JSON.parse(
      execFileSync('git', ['-C', root, 'show', 'HEAD:package.json'], { encoding: 'utf8' }),
    ).version,
    channel: 'production',
  })),
  samples: [],
}
try {
  for (const condition of ['fast', 'throttled']) {
    for (let repeat = 0; repeat < 5; repeat++) {
      // Alternate order so warm runner/CPU drift does not always favor one version.
      for (const index of repeat % 2 ? [1, 0] : [0, 1]) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          locale: 'en-US',
          reducedMotion: 'reduce',
        })
        await context.tracing.start({ screenshots: true, snapshots: true })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        if (condition === 'throttled') {
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 100,
            downloadThroughput: 200000,
            uploadThroughput: 100000,
          })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        }
        await page.addInitScript(() => {
          window.startupMetrics = { longTasks: [], ready: null }
          new PerformanceObserver((list) => {
            window.startupMetrics.longTasks.push(
              ...list
                .getEntries()
                .map((entry) => ({ start: entry.startTime, duration: entry.duration })),
            )
          }).observe({ type: 'longtask', buffered: true })
          const observe = () => {
            const check = () => {
              const control = document.querySelector(
                '#app button[aria-label="Add local documents"]',
              )
              if (control && !control.closest('[inert]') && control.getClientRects().length) {
                window.startupMetrics.ready = performance.now()
                observer.disconnect()
              }
            }
            const observer = new MutationObserver(check)
            observer.observe(document.documentElement, {
              subtree: true,
              childList: true,
              attributes: true,
            })
            check()
          }
          if (document.documentElement) observe()
          else document.addEventListener('DOMContentLoaded', observe, { once: true })
        })
        await page.goto(`http://127.0.0.1:${servers[index].address().port}/#/app`, {
          waitUntil: 'domcontentloaded',
        })
        await page.waitForFunction(() => window.startupMetrics.ready !== null, undefined, {
          timeout: 60000,
        })
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        const sample = await page.evaluate(() => {
          const ready = window.startupMetrics.ready
          const navigation = performance.getEntriesByType('navigation')[0]
          const resources = performance
            .getEntriesByType('resource')
            .filter((entry) => entry.startTime < ready)
          return {
            readyMs: ready,
            fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
            longTaskMs: window.startupMetrics.longTasks
              .filter((entry) => entry.start < ready)
              .reduce((sum, entry) => sum + entry.duration, 0),
            transferredBytes:
              navigation.transferSize +
              resources.reduce((sum, entry) => sum + entry.transferSize, 0),
            navigation: navigation.toJSON(),
            resources: resources.map((entry) => entry.toJSON()),
          }
        })
        if (errors.length) throw new Error(errors.join('\n'))
        results.samples.push({
          condition,
          repeat,
          version: results.identities[index].version,
          ...sample,
        })
        await context.tracing.stop({ path: `${output}/${condition}-${index}-${repeat}.zip` })
        await context.close()
      }
    }
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  results.summary = []
  for (const condition of ['fast', 'throttled']) {
    for (const identity of results.identities) {
      const rows = results.samples.filter(
        (sample) => sample.condition === condition && sample.version === identity.version,
      )
      results.summary.push({
        condition,
        version: identity.version,
        medianReadyMs: median(rows.map((row) => row.readyMs)),
        minReadyMs: Math.min(...rows.map((row) => row.readyMs)),
        maxReadyMs: Math.max(...rows.map((row) => row.readyMs)),
        medianTransferredBytes: median(rows.map((row) => row.transferredBytes)),
        medianLongTaskMs: median(rows.map((row) => row.longTaskMs)),
      })
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  const lines = [
    '# Comparative startup measurement',
    '',
    'Cold contexts/cache disabled; empty library; production channel; five repetitions per version/condition. Throttled: 100ms latency, 200kB/s download, 100kB/s upload, 4× CPU slowdown. These are Linux runner measurements, not an all-device performance guarantee.',
    '',
    '| Condition | Version | Median readiness (ms) | Range (ms) | Median transferred bytes | Long tasks (ms) |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (const row of results.summary)
    lines.push(
      `| ${row.condition} | ${row.version} | ${row.medianReadyMs.toFixed(1)} | ${row.minReadyMs.toFixed(1)}–${row.maxReadyMs.toFixed(1)} | ${row.medianTransferredBytes} | ${row.medianLongTaskMs.toFixed(1)} |`,
    )
  await writeFile(`${output}/summary.md`, lines.join('\n') + '\n')
  process.stdout.write(lines.join('\n') + '\n')
} finally {
  await browser.close()
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))))
}

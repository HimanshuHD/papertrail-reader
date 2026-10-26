// Manual, external Chromium profiling. Never imported by the app or wired into CI.
import { chromium, expect } from '@playwright/test'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPdfFixture } from '../tests/fixtures/pdf.ts'
import { createFormattedEpubFixture } from '../tests/fixtures/epub.ts'
import { startDiagnosticPreview } from './diagnostics-preview.mjs'
import { bundleEvidence } from './diagnostics-acceptance-report.mjs'
import {
  processRSSBatch,
  processInterval,
  traceSummary,
  calibrationCandidates,
  statistics,
  memorySummary,
  reportMarkdown,
} from './browser-profile-metrics.mjs'

const browserExecutable = await realpath(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const repeats = Number(process.env.PROFILE_REPEATS || 5)
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10)
  throw new Error('PROFILE_REPEATS must be 1..10')
const heaps = process.env.PROFILE_HEAPS === 'true'
const traces = process.env.PROFILE_TRACES !== 'false'
const modes = [
  'production',
  'closed',
  'sampling',
  'paused',
  'expanded',
  'sampling-sensors',
  'expanded-sensors',
  'paused-sensors',
]
const source = {
  sha: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: Boolean(git('status', '--porcelain')),
}
await mkdir(path.join(root, 'browser-evidence', 'external-profiling'), { recursive: true })
const out = await mkdtemp(path.join(root, 'browser-evidence', 'external-profiling', 'run-'))
const builds = await mkdtemp(path.join(os.tmpdir(), 'papertrail-external-profile-'))
const servers = []
const report = {
  schema: 1,
  source,
  status: 'incomplete',
  acceptedBudgets: false,
  environment: {
    node: process.version,
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    logicalCPUs: os.cpus().length,
    ramBytes: os.totalmem(),
    viewport: { width: 1440, height: 900 },
  },
  method: {
    repeats,
    cycles: 10,
    modes,
    sampleIntervalMs: 1000,
    settleMs: 2200,
    heaps,
    traces,
    headless: process.env.PROFILE_HEADED !== 'true',
    cache: 'Fresh browser per mode/repeat; fresh reader per cycle; OS cache uncontrolled',
    gpuUtilization: null,
    gpuAllocationBytes: null,
    gpuReason:
      'CDP process CPU is not GPU engine utilization or VRAM. Use platform profiler for physical GPU measurements.',
  },
  limitations: [
    'Fixture-only local Chromium evidence; no native folder, other-engine or actual device acceptance.',
    'CPU deltas cover matched CDP process identities. Processes that exit between polls can be missed; CPU coverage is a lower bound.',
    'RSS is available only when Linux /proc exposes the CDP process IDs. Sum includes shared resident pages and is not private memory. GPU-process RSS is host RAM, not VRAM.',
    'Page Performance metrics exclude other targets/workers. Trace event durations are inclusive, overlap, and are not a total CPU breakdown.',
    'Trace/heap capture adds overhead. First repeat trace mode is separate from subsequent repeats. Heap mode forces GC only at baseline/5/10 checkpoints; use a separate no-heap run for natural memory/latency.',
    'Sampling sees sampled peaks only, not guaranteed true peaks. Baseline/5/10 are settled observations, not proof of a leak or its absence.',
    'All local raw traces, heap snapshots, process IDs and environment metadata stay private. No upload transport.',
    'Observed latency is not an accepted user-experience budget. Saved-workspace/expiry/warm-dispatch, large-library and real-document calibration need separate matching evidence.',
  ],
  builds: {},
  runs: [],
  calibration: [],
}
const run = (args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Build failed (${code})`)),
    )
  })
const flush = async () => {
  await writeFile(path.join(out, 'summary.json'), JSON.stringify(report, null, 2) + '\n')
  await writeFile(path.join(out, 'report.md'), reportMarkdown(report))
}
const button = (page, name) => page.getByRole('button', { name, exact: true })
async function heapSnapshot(cdp, filename) {
  const stream = createWriteStream(filename)
  const chunks = ({ chunk }) => stream.write(chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', chunks)
  try {
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  } finally {
    cdp.off('HeapProfiler.addHeapSnapshotChunk', chunks)
    stream.end()
    await once(stream, 'finish')
  }
}
async function traceStop(cdp, filename) {
  const completed = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve))
  await cdp.send('Tracing.end')
  const { stream } = await completed
  const output = createWriteStream(filename)
  try {
    for (;;) {
      const chunk = await cdp.send('IO.read', { handle: stream })
      if (!output.write(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data))
        await once(output, 'drain')
      if (chunk.eof) break
    }
  } finally {
    await cdp.send('IO.close', { handle: stream })
    output.end()
    await once(output, 'finish')
  }
  return traceSummary(JSON.parse(await readFile(filename, 'utf8')).traceEvents)
}
async function profile(mode, trial) {
  const folder = path.join(out, `${mode}-${trial}`)
  await mkdir(folder)
  const browser = await chromium.launch({
    headless: process.env.PROFILE_HEADED !== 'true',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  })
  const row = {
    mode,
    trial,
    browserVersion: browser.version(),
    status: 'incomplete',
    traced: traces && trial === 1,
    heaps,
    cycles: [],
    samples: [],
    checkpoints: [],
    operations: [],
  }
  report.runs.push(row)
  let sampling = false,
    loop,
    tracing = false,
    browserCDP,
    activePage
  try {
    const context = await browser.newContext({
      viewport: report.environment.viewport,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    activePage = page
    page.setDefaultTimeout(10000)
    await page.goto(
      `http://127.0.0.1:${mode === 'production' ? 4176 : 4177}/?diagnostics=true#/app`,
    )
    await expect(page.locator('#app')).toHaveJSProperty('inert', false)
    await expect(page.locator('#startup-loading')).toBeHidden()
    const toggle = button(page, 'Developer diagnostics')
    if (mode === 'production') await expect(toggle).toHaveCount(0)
    else if (mode !== 'closed') {
      await toggle.click()
      if (mode.endsWith('-sensors')) {
        await page.getByRole('tab', { name: 'Sensors', exact: true }).click()
        await page.getByRole('checkbox', { name: 'Capture sensors', exact: true }).check()
        await page.getByRole('tab', { name: 'Overview', exact: true }).click()
      }
      if (mode.startsWith('paused')) await button(page, 'Pause').click()
      if (!mode.startsWith('expanded')) await button(page, 'Minimize diagnostics').click()
    }
    browserCDP = await browser.newBrowserCDPSession()
    const pageCDP = await context.newCDPSession(page)
    await pageCDP.send('Performance.enable')
    const sample = async (checkpoint) => {
      const started = performance.now()
      const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo')
      const rss = await processRSSBatch(
        processInfo.map((item) => item.id),
        browserExecutable,
      )
      const processes = processInfo.map((item) => ({ ...item, rssBytes: rss.get(item.id) ?? null }))
      const metrics = Object.fromEntries(
        (await pageCDP.send('Performance.getMetrics')).metrics
          .filter((item) =>
            [
              'JSHeapUsedSize',
              'JSHeapTotalSize',
              'Nodes',
              'Documents',
              'JSEventListeners',
              'TaskDuration',
              'ScriptDuration',
              'LayoutDuration',
              'RecalcStyleDuration',
            ].includes(item.name),
          )
          .map((item) => [item.name, item.value]),
      )
      const previous = row.samples.at(-1)
      const next = {
        atMs: started,
        checkpoint: checkpoint ?? null,
        processes,
        pageMetrics: metrics,
        pollCostMs: performance.now() - started,
      }
      if (previous)
        next.cpuInterval = processInterval(previous.processes, processes, started - previous.atMs)
      row.samples.push(next)
      return next
    }
    const checkpoint = async (cycle) => {
      // Real foreground observation; identical across modes, no fake timer acceleration.
      expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
      await page.waitForTimeout(2200)
      if (heaps) await heapSnapshot(pageCDP, path.join(folder, `heap-${cycle}.heapsnapshot`))
      const snapshot = await sample(cycle)
      row.checkpoints.push({
        cycle,
        sampleIndex: row.samples.indexOf(snapshot),
        afterForcedGC: heaps,
      })
    }
    await checkpoint(0)
    if (row.traced) {
      await browserCDP.send('Tracing.start', {
        categories: 'devtools.timeline,v8,blink.user_timing',
        transferMode: 'ReturnAsStream',
      })
      tracing = true
    }
    const start = performance.now()
    sampling = true
    loop = (async () => {
      while (sampling) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (sampling) await sample()
      }
    })()
    // Prevent an asynchronous sampler failure becoming an unhandled rejection.
    loop.catch(() => {})
    const pdf = createPdfFixture(12),
      epub = Buffer.from(createFormattedEpubFixture())
    await page.locator('input[accept*=".pdf"]').setInputFiles([
      { name: 'profile.pdf', mimeType: 'application/pdf', buffer: pdf },
      { name: 'profile.epub', mimeType: 'application/epub+zip', buffer: epub },
    ])
    row.fixture = { pdfPages: 12, pdfBytes: pdf.length, epubBytes: epub.length }
    const open = async (format) => {
      const show = button(page, 'Show library')
      if (await show.isVisible()) await show.click()
      const entry = page
        .getByRole('region', { name: 'Library documents', exact: true })
        .getByRole('button', { name: `${format}: profile.${format.toLowerCase()}`, exact: true })
      await entry.click()
      await expect(entry).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByRole('tab', { name: new RegExp(`^${format}: profile\\.`) }),
      ).toHaveAttribute('aria-selected', 'true')
      await button(page, 'Hide library').click()
      if (format === 'PDF') {
        await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
          'aria-busy',
          'false',
        )
        const current = await page
          .getByRole('spinbutton', { name: 'Current page', exact: true })
          .inputValue()
        await expect(page.locator(`[data-pdf-page="${current}"]`)).toHaveAttribute(
          'data-render-state',
          'ready',
        )
      } else
        await expect(
          page
            .locator('.epub-reader:visible')
            .frameLocator('iframe')
            .getByRole('heading', { name: 'Formatted chapter', exact: true }),
        ).toBeVisible()
    }
    for (let cycle = 1; cycle <= 10; cycle++) {
      const timings = {}
      for (const format of ['PDF', 'EPUB']) {
        const began = performance.now()
        await open(format)
        timings[`${format.toLowerCase()}OpenToReadableMs`] = performance.now() - began
      }
      const input = page.getByRole('tab', { name: /^PDF: profile\.pdf/ })
      await input.click()
      const pageNumber = page.getByRole('spinbutton', { name: 'Current page', exact: true })
      await pageNumber.fill('12')
      await pageNumber.press('Tab')
      await expect(page.locator('[data-pdf-page="12"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
      await button(page, 'Close profile.pdf').click()
      await button(page, 'Close profile.epub').click()
      await expect(page.locator('.pdf-reader, .epub-reader')).toHaveCount(0)
      row.cycles.push({ cycle, ...timings })
      if (cycle === 5 || cycle === 10) {
        // Serialize checkpoint reads with polling; never overlap CDP heap/metrics operations.
        sampling = false
        await loop
        await checkpoint(cycle)
        if (cycle < 10) {
          sampling = true
          loop = (async () => {
            while (sampling) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              if (sampling) await sample()
            }
          })()
          loop.catch(() => {})
        }
      }
    }
    row.elapsedMs = performance.now() - start
    if (tracing) {
      row.trace = await traceStop(browserCDP, path.join(folder, 'trace.json'))
      tracing = false
    }
    if (!['production', 'closed'].includes(mode)) {
      if (!mode.startsWith('expanded')) await toggle.click()
      const pending = page.waitForEvent('download')
      await button(page, 'Export local JSON').click()
      const text = await readFile(await (await pending).path(), 'utf8')
      expect(text).not.toMatch(/profile\.(pdf|epub)|Formatted chapter|Author formatting/)
      const data = JSON.parse(text)
      expect(data.identity.sourceSha).toBe(source.sha)
      expect(data.running).toBe(!mode.startsWith('paused'))
      row.resources = data.resources
      expect(data.resources.viewers ?? 0).toBe(0)
      expect(data.resources.pdfWorkerOwners ?? 0).toBe(0)
      expect(data.resources.blobURLs ?? 0).toBe(0)
      row.operations = [
        ...data.timings
          .filter((item) => item.outcome === 'completed')
          .map((item) => ({ mode, profile: item.metric, durationMs: item.durationMs })),
        ...data.resourceInvestigation.timings
          .filter((item) => item.outcome === 'completed')
          .map((item) => ({ mode, profile: item.operation, durationMs: item.durationMs })),
      ].filter((item) =>
        [
          'pdf.cold-open',
          'epub.cold-open',
          'pdf.render',
          'pdf.navigation',
          'epub.chapter',
          'epub.reflow',
          'library.scan',
          'library.first-listing',
        ].includes(item.profile),
      )
    }
    row.memory = memorySummary(row)
    row.status = 'passed'
  } catch (error) {
    row.status = 'failed'
    row.failure = error.message
    await activePage?.screenshot({ path: path.join(folder, 'failure.png') }).catch(() => {})
    row.failureState = await activePage
      ?.evaluate(() => ({
        pages: [...document.querySelectorAll('[data-pdf-page]')].map((node) => ({
          page: node.getAttribute('data-pdf-page'),
          state: node.getAttribute('data-render-state'),
          top: node.getBoundingClientRect().top,
          height: node.getBoundingClientRect().height,
        })),
        currentPage: document.querySelector('input[aria-label="Current page"]')?.value,
        loading: [...document.querySelectorAll('.loading-card')].length,
      }))
      .catch(() => null)
    throw error
  } finally {
    sampling = false
    await loop?.catch(() => {})
    if (tracing)
      await traceStop(browserCDP, path.join(folder, 'partial-trace.json')).catch(() => {})
    await browser.close()
    await flush()
  }
}
try {
  for (const [mode, enabled] of [
    ['production', false],
    ['diagnostic', true],
  ]) {
    const destination = path.join(builds, mode)
    await run(['node_modules/vite/bin/vite.js', 'build', '--outDir', destination], {
      VITE_DEPLOY_CHANNEL: 'production',
      VITE_READER_DIAGNOSTICS: String(enabled),
      VITE_BUILD_SHA: source.sha,
    })
    report.builds[mode] = await bundleEvidence(destination)
    if (Object.values(report.builds[mode].diagnosticMarkers).some((present) => present !== enabled))
      throw new Error('Diagnostic bundle boundary failed')
    servers.push(await startDiagnosticPreview(mode, { DIAGNOSTIC_BUILD_ROOT: builds }))
  }
  for (let trial = 1; trial <= repeats; trial++) {
    for (let offset = 0; offset < modes.length; offset++)
      await profile(modes[(offset + trial - 1) % modes.length], trial)
  }
  report.calibration = calibrationCandidates(report.runs.flatMap((row) => row.operations))
  report.wallTime = modes.map((mode) => ({
    mode,
    untracedOnly: true,
    ...(() => {
      const rows = report.runs.filter((row) => row.mode === mode && !row.traced)
      return rows.length
        ? statistics(rows.map((row) => row.elapsedMs))
        : { count: 0, median: null, worst: null, p95: null }
    })(),
  }))
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = error.message
  process.exitCode = 1
} finally {
  await flush()
  for (const server of servers) await new Promise((resolve) => server.httpServer.close(resolve))
  await rm(builds, { recursive: true, force: true })
  console.log(
    `External profiling report (private): ${path.relative(root, path.join(out, 'summary.json'))}`,
  )
}

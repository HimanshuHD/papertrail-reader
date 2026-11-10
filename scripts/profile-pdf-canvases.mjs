// Manual generated-fixture investigation; never imported by the app or run in CI.
import { chromium, expect } from '@playwright/test'
import { build, preview } from 'vite'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPdfFixture, createImagePdfFixture } from '../tests/fixtures/pdf.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const repeats = Number(process.env.CANVAS_PROFILE_REPEATS || 3)
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw Error('Repeats must be 1..5')
const source = {
  sha: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: !!git('status', '--porcelain'),
}
const folder = await mkdtemp(path.join(os.tmpdir(), 'papertrail-canvas-build-'))
const outputRoot = path.join(root, 'browser-evidence', 'canvas-profiling')
await mkdir(outputRoot, { recursive: true })
const output = await mkdtemp(path.join(outputRoot, 'run-'))
const report = {
  schema: 1,
  source,
  status: 'incomplete',
  repeats,
  method: {
    channel: 'production',
    diagnostics: false,
    viewport: { width: 1440, height: 1000 },
    densities: [1, 2],
    zooms: [100, 200, 400],
    settleMs: 600,
    canvasBytes:
      'Observed live HTML 2D canvas width × height × 4; calculated backing estimate, not physical memory.',
    heap: 'CDP page JSHeapUsedSize, without forced GC; excludes workers/native buffers.',
    rss: 'Matched CDP process IDs readable through Linux /proc; summed RSS includes shared pages. Namespace mismatch is unavailable.',
    gpuAllocationBytes: null,
    gpuReason: 'Physical GPU allocation is unavailable; GPU-process RSS is not GPU memory.',
    limitation:
      'Instrumented local Chromium only. Weak references avoid owning canvases. Samples/probe overhead alter latency; no CPU/latency conclusion, leak claim or universal budget.',
  },
  runs: [],
}
async function flush() {
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n')
}

function installCanvasProbe() {
  const refs = new Set()
  const known = new WeakSet()
  let closeOnAllocation = false
  let closeTriggered = false
  let peakCanvases = []
  let peakBytes = 0,
    copyPeakBytes = 0,
    maxCopyPairBytes = 0,
    copies = 0
  function values() {
    let bytes = 0,
      connectedBytes = 0,
      detachedBytes = 0,
      canvases = 0
    for (const ref of refs) {
      const canvas = ref.deref()
      if (!canvas) {
        refs.delete(ref)
        continue
      }
      const size = canvas.width * canvas.height * 4
      if (!size) continue
      canvases++
      bytes += size
      if (canvas.isConnected) connectedBytes += size
      else detachedBytes += size
    }
    return { bytes, connectedBytes, detachedBytes, canvases }
  }
  function changed(canvas) {
    if (closeOnAllocation && !canvas.isConnected && canvas.width > 192) {
      closeOnAllocation = false
      closeTriggered = true
      queueMicrotask(() =>
        document.querySelector('button[aria-label="Close profile.pdf"]')?.click(),
      )
    }
    if (!known.has(canvas)) {
      known.add(canvas)
      refs.add(new WeakRef(canvas))
    }
    const bytes = values().bytes
    if (bytes > peakBytes) {
      peakBytes = bytes
      peakCanvases = [...refs].flatMap((ref) => {
        const canvas = ref.deref()
        return canvas?.width && canvas.height
          ? [{ width: canvas.width, height: canvas.height, connected: canvas.isConnected }]
          : []
      })
    }
  }
  const prototype = HTMLCanvasElement.prototype
  const context = prototype.getContext
  prototype.getContext = function (...args) {
    const result = context.apply(this, args)
    if (args[0] === '2d' && result) changed(this)
    return result
  }
  for (const property of ['width', 'height']) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
    Object.defineProperty(prototype, property, {
      ...descriptor,
      set(value) {
        descriptor.set.call(this, value)
        if (known.has(this)) changed(this)
      },
    })
  }
  const draw = CanvasRenderingContext2D.prototype.drawImage
  CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
    if (image instanceof HTMLCanvasElement && this.canvas.closest('.pdf-page')) {
      copies++
      copyPeakBytes = Math.max(copyPeakBytes, values().bytes)
      maxCopyPairBytes = Math.max(
        maxCopyPairBytes,
        (this.canvas.width * this.canvas.height + image.width * image.height) * 4,
      )
    }
    return draw.call(this, image, ...args)
  }
  globalThis.__canvasProbe = {
    armClose: () => {
      closeOnAllocation = true
    },
    sample: () => ({
      ...values(),
      peakBytes,
      peakCanvases,
      closeTriggered,
      copyPeakBytes,
      maxCopyPairBytes,
      copies,
    }),
    reset: () => {
      peakBytes = values().bytes
      peakCanvases = []
      closeTriggered = false
      copyPeakBytes = 0
      maxCopyPairBytes = 0
      copies = 0
    },
  }
}

async function rss(cdp) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo')
  const rows = await Promise.all(
    processInfo.map(async ({ id, type }) => {
      try {
        const status = await readFile(`/proc/${id}/status`, 'utf8')
        const match = /^VmRSS:\s+(\d+) kB$/m.exec(status)
        return match ? { type, bytes: Number(match[1]) * 1024 } : null
      } catch {
        return null
      }
    }),
  )
  const available = rows.filter(Boolean)
  return {
    bytes:
      available.length === processInfo.length
        ? available.reduce((sum, row) => sum + row.bytes, 0)
        : null,
    matched: available.length,
    expected: processInfo.length,
  }
}
let server
try {
  process.env.VITE_DEPLOY_CHANNEL = 'production'
  process.env.VITE_READER_DIAGNOSTICS = 'false'
  await build({ root, build: { outDir: folder }, logLevel: 'warn' })
  server = await preview({
    root,
    configFile: false,
    build: { outDir: folder },
    preview: { host: '127.0.0.1', port: 4186, strictPort: true },
  })
  for (const [fixture, buffer] of [
    ['text', createPdfFixture(12)],
    ['image', createImagePdfFixture()],
  ]) {
    for (const density of [1, 2])
      for (let repetition = 1; repetition <= repeats; repetition++) {
        const browser = await chromium.launch({
          headless: true,
          ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
            : {}),
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        })
        const row = {
          fixture,
          density,
          repetition,
          browser: browser.version(),
          checkpoints: [],
          sampledPeakRSSBytes: null,
          rssComplete: true,
        }
        report.runs.push(row)
        try {
          const context = await browser.newContext({
            viewport: report.method.viewport,
            deviceScaleFactor: density,
          })
          const page = await context.newPage()
          await page.addInitScript(installCanvasProbe)
          const cdp = await context.newCDPSession(page),
            processCdp = await browser.newBrowserCDPSession()
          await cdp.send('Performance.enable')
          let sampling = false
          const timer = setInterval(async () => {
            if (sampling) return
            sampling = true
            try {
              const sample = await rss(processCdp)
              if (sample.bytes === null) row.rssComplete = false
              else row.sampledPeakRSSBytes = Math.max(row.sampledPeakRSSBytes ?? 0, sample.bytes)
            } catch {
              row.rssComplete = false
            } finally {
              sampling = false
            }
          }, 100)
          timer.unref()
          try {
            async function checkpoint(name) {
              await page.waitForTimeout(report.method.settleMs)
              await expect(page.locator('.pdf-reader [data-render-state="rendering"]')).toHaveCount(
                0,
                { timeout: 30000 },
              )
              const metrics = await cdp.send('Performance.getMetrics')
              row.checkpoints.push({
                name,
                canvas: await page.evaluate(() => globalThis.__canvasProbe.sample()),
                jsHeapBytes:
                  metrics.metrics.find((x) => x.name === 'JSHeapUsedSize')?.value ?? null,
                rss: await rss(processCdp),
              })
              await flush()
            }
            const reader = page.locator('.pdf-reader')
            const zoom = page.getByRole('spinbutton', { name: 'PDF zoom percent', exact: true })
            async function ready(number = 1) {
              await expect(reader.locator(`[data-pdf-page="${number}"]`)).toHaveAttribute(
                'data-render-state',
                'ready',
                { timeout: 30000 },
              )
            }
            async function setZoom(value) {
              await zoom.fill(String(value))
              await zoom.press('Enter')
              await expect(zoom).toHaveValue(String(value))
              await ready()
            }
            await page.goto('http://127.0.0.1:4186/#/app')
            await expect(page.locator('#app')).toHaveJSProperty('inert', false)
            await checkpoint('baseline')
            await page
              .locator('input[accept*=".pdf"]')
              .setInputFiles({ name: 'profile.pdf', mimeType: 'application/pdf', buffer })
            await page
              .getByRole('region', { name: 'Library documents', exact: true })
              .getByRole('button', { name: 'PDF: profile.pdf', exact: true })
              .click()
            await page.getByRole('button', { name: 'Hide library', exact: true }).click()
            await ready()
            await checkpoint('open-fit')
            for (const value of report.method.zooms) {
              await page.evaluate(() => globalThis.__canvasProbe.reset())
              await setZoom(value)
              await checkpoint(`zoom-${value}`)
            }
            await setZoom(100)
            await page.evaluate(() => globalThis.__canvasProbe.reset())
            await page.getByRole('button', { name: 'Two-page view', exact: true }).click()
            await ready()
            await checkpoint('two-page-100')
            const field = page.getByRole('spinbutton', { name: 'Current page', exact: true })
            await page.evaluate(() => globalThis.__canvasProbe.reset())
            await field.fill('12')
            await field.press('Enter')
            await ready(12)
            await checkpoint('distant-page-12')
            await expect(reader.locator('[data-pdf-page="1"] canvas')).toHaveJSProperty('width', 0)
            await page.evaluate(() => {
              const zoom = document.querySelector('input[aria-label="PDF zoom percent"]')
              globalThis.__canvasProbe.armClose()
              zoom.value = '400'
              zoom.dispatchEvent(new Event('change', { bubbles: true }))
            })
            await expect(reader).toHaveCount(0)
            await checkpoint('closed-600ms')
            await page.waitForTimeout(1600)
            await checkpoint('closed-2800ms')
            row.status = 'complete'
          } finally {
            clearInterval(timer)
          }
        } finally {
          await browser.close()
          await flush()
        }
      }
  }
  report.status = 'complete'
} finally {
  if (server) await new Promise((resolve) => server.httpServer.close(resolve))
  await rm(folder, { recursive: true, force: true })
  await flush()
}
console.log('Private canvas profile saved under browser-evidence/canvas-profiling.')

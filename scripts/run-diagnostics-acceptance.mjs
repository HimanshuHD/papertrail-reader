// Manual functional/workload acceptance. Never a Visual QA gate or accepted performance budget.
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  acceptanceOptions,
  bundleEvidence,
  summarizeTrials,
  verifyTrialCoverage,
} from './diagnostics-acceptance-report.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const options = acceptanceOptions()
await mkdir(path.join(root, 'browser-evidence', 'diagnostics-acceptance'), { recursive: true })
const out = await mkdtemp(path.join(root, 'browser-evidence', 'diagnostics-acceptance', 'run-'))
const builds = await mkdtemp(path.join(os.tmpdir(), 'papertrail-diagnostic-acceptance-'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const source = {
  sha: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: Boolean(git('status', '--porcelain')),
}
const run = (args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`Command failed: ${args[0]} (${signal || code})`)),
    )
  })
const report = {
  schema: 1,
  source,
  options,
  environment: {
    node: process.version,
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    logicalCPUs: os.cpus().length,
    totalRAMBytes: os.totalmem(),
  },
  builds: {},
  trials: [],
  summary: [],
  status: 'incomplete',
  limitations: [
    'Synthetic text PDF and formatted EPUB fixtures; not representative image-heavy/long-document or 100/1000-folder scanning acceptance.',
    'Fresh browser contexts are application-cold; OS filesystem and browser process caches are not flushed. Repeat/warm steps run inside each trial.',
    'Elapsed wall time includes browser rendering and automation. No CPU/GPU/process-memory measurement, causal attribution, accepted budget or speedup claim.',
    'No forced GC, artificial clock advancement or callback-only total-overhead claim. Sampler subset and JS heap remain separately labelled in private export.',
    'Expanded-panel rendering and optional additional-sensor overhead are not calibrated by the minimized base-sampling workload.',
    'Other engines require installed Playwright browsers/dependencies. Missing engines fail rather than silently pass.',
  ],
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
      throw new Error(`Diagnostic bundle boundary failed: ${mode}`)
  }
  await run(
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.diagnostics.config.ts',
    ],
    {
      DIAGNOSTIC_BUILD_ROOT: builds,
      DIAGNOSTIC_REPORT_DIR: out,
      DIAGNOSTIC_ENGINES: options.engines.join(','),
      DIAGNOSTIC_TRIALS: String(options.trials),
      DIAGNOSTIC_EXPECTED_SHA: source.sha,
      E2E_DIAGNOSTICS: 'true',
      E2E_DEPLOY_CHANNEL: 'production',
    },
  )
  const results = JSON.parse(await readFile(path.join(out, 'playwright.json'), 'utf8'))
  const walk = async (suite) => {
    for (const spec of suite.specs || [])
      for (const test of spec.tests || [])
        for (const result of test.results || [])
          for (const attachment of result.attachments || []) {
            if (attachment.name !== 'diagnostic-workload-trials') continue
            const data = JSON.parse(
              attachment.body
                ? Buffer.from(attachment.body, 'base64').toString('utf8')
                : await readFile(attachment.path, 'utf8'),
            )
            report.trials.push(...data)
          }
    for (const child of suite.suites || []) await walk(child)
  }
  await walk(results)
  verifyTrialCoverage(report.trials, options.engines, options.trials)
  report.bundleDeltaBytes = report.builds.diagnostic.bytes - report.builds.production.bytes
  report.summary = summarizeTrials(report.trials)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = error.message
  process.exitCode = 1
} finally {
  await writeFile(path.join(out, 'summary.json'), JSON.stringify(report, null, 2) + '\n')
  await rm(builds, { recursive: true, force: true })
  console.log(
    `Diagnostics acceptance report: ${path.relative(root, path.join(out, 'summary.json'))}`,
  )
}

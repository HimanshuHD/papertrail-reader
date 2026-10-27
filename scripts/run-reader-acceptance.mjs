// Manual functional acceptance only. No clocks are advanced and no workflow invokes this.
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engines = (process.env.READER_ACCEPTANCE_ENGINES || 'chromium').split(',')
if (
  new Set(engines).size !== engines.length ||
  engines.some((name) => !['chromium', 'firefox', 'webkit'].includes(name))
)
  throw new Error('READER_ACCEPTANCE_ENGINES must contain unique chromium,firefox,webkit names')
await mkdir(path.join(root, 'browser-evidence/reader-acceptance'), { recursive: true })
const report = await mkdtemp(path.join(root, 'browser-evidence/reader-acceptance/run-'))
const build = await mkdtemp(path.join(os.tmpdir(), 'papertrail-reader-acceptance-'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const source = {
  sha: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: Boolean(git('status', '--porcelain')),
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
      code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${args[0]}`)),
    )
  })
const result = {
  schema: 1,
  source,
  engines,
  status: 'incomplete',
  nativePermissionAcceptance: false,
  performanceAcceptance: false,
}
try {
  await run(
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', path.join(build, 'diagnostic')],
    {
      VITE_DEPLOY_CHANNEL: 'production',
      VITE_READER_DIAGNOSTICS: 'true',
      VITE_BUILD_SHA: source.sha,
    },
  )
  await run(
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.reader-acceptance.config.ts',
    ],
    {
      DIAGNOSTIC_BUILD_ROOT: build,
      READER_ACCEPTANCE_REPORT: report,
      DIAGNOSTIC_EXPECTED_SHA: source.sha,
    },
  )
  const data = JSON.parse(await readFile(path.join(report, 'playwright.json'), 'utf8'))
  if (data.stats.unexpected || data.stats.flaky || data.stats.skipped || !data.stats.expected)
    throw new Error('Reader acceptance requires passed cases without failures, flakes or skips')
  result.status = 'passed'
} catch (error) {
  result.status = 'failed'
  console.error(error.message)
  process.exitCode = 1
} finally {
  await writeFile(path.join(report, 'summary.json'), JSON.stringify(result, null, 2))
  await rm(build, { recursive: true, force: true })
  console.log(`Private reader acceptance evidence: ${report}`)
}

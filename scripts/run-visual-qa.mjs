import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { selectBaselines } from './visual-baselines.mjs'
await fs.mkdir('visual-evidence', { recursive: true })
const result = {
  automated: 'fail',
  evidence: 'blocked',
  initialDesignReview: 'pending',
  visualRegression: 'not-run',
  reason: '',
}
try {
  const build = JSON.parse(await fs.readFile('dist/build.json', 'utf8'))
  const baseline = await selectBaselines(build.channel)
  const manifest = baseline.manifest
  const acceptance = process.env.VISUAL_ACCEPTANCE === 'true'
  if (acceptance && !manifest.enabled) {
    result.automated = 'not-run'
    result.reason = 'No owner-approved baselines; initial design review remains pending.'
  } else {
    const regression =
      manifest.enabled && (process.env.VISUAL_PROFILE || 'startup') === manifest.profile
    if (regression) {
      const osRelease = await fs.readFile('/etc/os-release', 'utf8')
      const version = JSON.parse(
        await fs.readFile('node_modules/playwright/package.json', 'utf8'),
      ).version
      if (
        !/^ID=ubuntu$/m.test(osRelease) ||
        !/^VERSION_ID="24.04"$/m.test(osRelease) ||
        version !== manifest.environment.playwright
      )
        throw new Error('Approved baseline OS/Playwright environment mismatch')
    }
    const run = (args) =>
      spawnSync(
        process.execPath,
        [
          'node_modules/@playwright/test/cli.js',
          'test',
          '--config',
          'playwright.visual.config.ts',
          ...args,
        ],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            VISUAL_BASELINE_ROOT: baseline.root,
            VISUAL_RESULT_NAME: args[0] === 'regression.spec.ts' ? 'regression' : 'assertions',
          },
        },
      )
    const child = run(['capture.spec.ts'])
    result.automated = child.status === 0 ? 'pass' : 'fail'
    result.reason =
      child.status === 0
        ? ''
        : 'Browser setup or assertions failed; inspect traces and console evidence. This is not a manual design judgment.'
    if (child.error) result.reason = child.error.message
    process.exitCode = child.status === 0 ? 0 : 1
    if (regression && child.status === 0) {
      const comparison = run(['regression.spec.ts'])
      result.visualRegression = comparison.status === 0 ? 'pass' : 'fail'
      if (comparison.status !== 0) {
        process.exitCode = 1
        result.reason =
          'Browser assertions passed; approved visual comparison failed. Inspect pixel diffs/environment errors separately.'
      }
    }
  }
} catch (error) {
  result.reason = error.message
  process.exitCode = 1
}
await fs.writeFile('visual-evidence/status.json', JSON.stringify(result, null, 2))

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { validateBaselines, selectBaselines } from './visual-baselines.mjs'
import { verifyCandidate } from './candidate-artifact.mjs'

const channel = process.env.REVIEW_CHANNEL
if (!['preview', 'staging', 'production'].includes(channel)) throw Error('Invalid review channel')
const runtime = await validateBaselines()
if (runtime.enabled) throw Error('Shared baseline gating must remain disabled during review')
const outcomes = []
{
  const { manifest: approval } = await selectBaselines(channel)
  if (!approval.enabled) throw Error('An explicitly approved baseline set is required')
  // Manual Visual QA supplies a checksum-verified candidate; never rebuild another source.
  if (!process.env.REVIEW_BUILD_FOLDER) throw Error('A verified candidate folder is required')
  if (process.env.VISUAL_PROFILE !== 'startup')
    throw Error('Repeat stability requires the startup profile')
  const folder = path.resolve(process.env.REVIEW_BUILD_FOLDER)
  const build = JSON.parse(await fs.readFile(folder + '/build.json', 'utf8'))
  if (build.channel !== channel) throw Error('Candidate channel mismatch')
  await verifyCandidate(folder, build)
  if (folder !== path.resolve('dist')) {
    await fs.rm('dist', { recursive: true, force: true })
    await fs.cp(folder, 'dist', { recursive: true })
  }
  const captures = []
  for (let repeat = 1; repeat <= 2; repeat++) {
    for (const dir of ['visual-evidence', 'visual-results', 'visual-report'])
      await fs.rm(dir, { recursive: true, force: true })
    const result = spawnSync(process.execPath, ['scripts/run-visual-qa.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_PATH: build.basePath, VISUAL_PROFILE: 'startup' },
    })
    const report = spawnSync(process.execPath, ['scripts/visual-qa-report.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, VISUAL_PROFILE: 'startup' },
    })
    const dest = `baseline-review-evidence/${channel}-${repeat}`
    await fs.mkdir(dest, { recursive: true })
    for (const dir of ['visual-evidence', 'visual-results', 'visual-report'])
      await fs.cp(dir, dest + '/' + dir, { recursive: true }).catch((error) => {
        if (error.code !== 'ENOENT') throw error
      })
    await fs.writeFile(dest + '/candidate.json', JSON.stringify(build, null, 2))
    const hashes = {}
    for (const file of Object.keys(approval.files)) {
      try {
        hashes[file] = createHash('sha256')
          .update(await fs.readFile('visual-evidence/' + file))
          .digest('hex')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    captures.push(hashes)
    outcomes.push({
      repeat,
      exitCode: result.status === 0 && report.status === 0 ? 0 : 1,
      comparisonExitCode: result.status,
      reportExitCode: report.status,
      error: result.error?.message,
      captures: hashes,
    })
  }
  const byteStable = Object.keys(approval.files).every(
    (file) => captures[0][file] && captures[0][file] === captures[1][file],
  )
  // Compare repeats through the same public Playwright matcher and unchanged pixel policy.
  // Byte hashes remain evidence, but tiny rasterization differences must use that policy too.
  const stability = spawnSync(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.visual.config.ts',
      'stability.spec.ts',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VISUAL_RESULT_NAME: 'stability',
        VISUAL_STABILITY_REFERENCE: path.resolve(
          `baseline-review-evidence/${channel}-1/visual-evidence`,
        ),
        VISUAL_STABILITY_ACTUAL: path.resolve(
          `baseline-review-evidence/${channel}-2/visual-evidence`,
        ),
      },
    },
  )
  const stable = stability.status === 0
  for (const dir of ['visual-evidence', 'visual-results', 'visual-report'])
    await fs
      .cp(dir, `baseline-review-evidence/${channel}-stability/${dir}`, { recursive: true })
      .catch((error) => {
        if (error.code !== 'ENOENT') throw error
      })
  await fs.writeFile(
    `baseline-review-evidence/${channel}-summary.json`,
    JSON.stringify(
      { channel, stable, byteStable, stabilityExitCode: stability.status, outcomes },
      null,
      2,
    ),
  )
  if (!stable || outcomes.some((result) => result.exitCode !== 0))
    throw Error(`${channel} diagnostic failed; inspect retained differences before activation`)
}

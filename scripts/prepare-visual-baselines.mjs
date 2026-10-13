// Explicit local preparation only. Normal CI can never adopt screenshots.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { validateBaselines } from './visual-baselines.mjs'
if (process.env.CI) throw new Error('Baseline preparation is forbidden in CI')
const [evidence, reviewFile] = process.argv.slice(2)
if (!evidence || !reviewFile)
  throw new Error(
    'Usage: node scripts/prepare-visual-baselines.mjs EVIDENCE_FOLDER OWNER_REVIEW_JSON',
  )
const review = JSON.parse(await fs.readFile(reviewFile, 'utf8'))
const status = JSON.parse(await fs.readFile(path.join(evidence, 'status.json'), 'utf8'))
if (status.automated !== 'pass' || status.evidence !== 'captured' || status.stale)
  throw new Error('Only complete current passing browser evidence can prepare baselines')
const candidate = JSON.parse(await fs.readFile(path.join(evidence, 'candidate.json'), 'utf8'))
if (
  candidate.plan.headSha !== review.sourceSha ||
  String(candidate.plan.runId) !== String(review.candidateRun)
)
  throw new Error('Owner review source/run does not match captured candidate')
const output = 'tests/visual/baselines'
const staging = 'visual-evidence/baseline-preparation'
await fs.rm(staging, { recursive: true, force: true })
await fs.mkdir(staging, { recursive: true })
const files = {}
let browserVersion
for (const width of [375, 1440, 1586])
  for (const theme of ['light', 'dark'])
    for (const state of [
      'loading',
      'loading-reduced',
      'ready',
      'library-hidden',
      'error',
      'retry-ready',
    ]) {
      const key = `chromium-${width}-${theme}/${state}.png`
      const identity = JSON.parse(
        await fs.readFile(path.join(evidence, key.replace('.png', '.json')), 'utf8'),
      )
      const bytes = await fs.readFile(path.join(evidence, key))
      const hash = createHash('sha256').update(bytes).digest('hex')
      if (
        identity.screenshotSha256 !== hash ||
        identity.candidate.headSha !== review.sourceSha ||
        identity.density !== 1 ||
        identity.viewport.width !== width ||
        identity.theme !== theme ||
        String(identity.run) !== String(review.evidenceRun) ||
        identity.playwright !== '1.63.0' ||
        !/^ID=ubuntu$/m.test(identity.osRelease || '') ||
        !/^VERSION_ID="24.04"$/m.test(identity.osRelease || '')
      )
        throw new Error('Capture identity mismatch: ' + key)
      if (browserVersion && browserVersion !== identity.browser)
        throw new Error('Mixed browser versions')
      browserVersion = identity.browser
      files[key] = hash
      await fs.mkdir(path.dirname(path.join(staging, key)), { recursive: true })
      await fs.writeFile(path.join(staging, key), bytes)
    }
const manifest = {
  schema: 1,
  enabled: true,
  profile: 'startup',
  environment: {
    os: 'ubuntu-24.04',
    playwright: '1.63.0',
    browser: 'chromium',
    browserVersion,
    density: 1,
  },
  approval: review,
  files,
}
await fs.writeFile(path.join(staging, 'approval.json'), JSON.stringify(manifest, null, 2) + '\n')
await validateBaselines(staging)
// Changes are now concrete for a dedicated reviewed baseline PR; this is not owner approval.
await fs.cp(staging, output, { recursive: true })
console.log(
  'Prepared baseline diff. Review and merge an explicit baseline-update PR before acceptance uses it.',
)

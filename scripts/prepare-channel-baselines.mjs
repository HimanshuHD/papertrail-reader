// Explicit reviewed-artifact preparation only; CI must never adopt its own screenshots.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import { validateBaselines } from './visual-baselines.mjs'
if (process.env.CI) throw Error('Baseline preparation is forbidden in CI')
const [zipFile, reviewFile] = process.argv.slice(2)
if (!zipFile || !reviewFile)
  throw Error('Usage: prepare-channel-baselines.mjs ARTIFACT_ZIP REVIEW_JSON')
const review = JSON.parse(await fs.readFile(reviewFile, 'utf8'))
const channel = review.channel
if (!['preview', 'staging', 'production'].includes(channel)) throw Error('Invalid reviewed channel')
const bytes = await fs.readFile(zipFile)
const hash = (value) => createHash('sha256').update(value).digest('hex')
if (hash(bytes) !== review.artifactZipSha256) throw Error('Approved artifact ZIP checksum mismatch')
const zip = unzipSync(bytes)
const get = (name) => {
  if (!zip[name]) throw Error('Missing capture evidence: ' + name)
  return Buffer.from(zip[name])
}
const json = (name) => JSON.parse(get(name).toString('utf8'))
const summary = json(`${channel}-summary.json`)
if (!summary.stable || summary.stabilityExitCode !== 0)
  throw Error('Repeated stability is not accepted')
const output = `tests/visual/baselines/channels/${channel}`
const history = `visual-evidence/channel-preparation-history/${channel}`
const files = {},
  sidecars = {}
let browserVersion
const candidate = json(`${channel}-1/candidate.json`)
if (
  candidate.headSha !== review.sourceSha ||
  candidate.sha !== review.captureSourceSha ||
  candidate.tree !== review.tree ||
  candidate.channel !== channel ||
  String(candidate.runId) !== String(review.candidateRun)
)
  throw Error('Approved source/candidate mismatch')
for (const repeat of [1, 2]) {
  const status = json(`${channel}-${repeat}/visual-evidence/status.json`)
  // Keep these original comparison failures: this explicit approval is what permits adoption.
  if (status.automated !== 'pass') throw Error('Capture assertions did not pass')
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
        const raw = get(`${channel}-${repeat}/visual-evidence/${key}`)
        const sidecarKey = key.replace('.png', '.json')
        const identity = json(`${channel}-${repeat}/visual-evidence/${sidecarKey}`)
        if (
          identity.screenshotSha256 !== hash(raw) ||
          identity.candidate.headSha !== review.sourceSha ||
          identity.candidate.sha !== review.captureSourceSha ||
          identity.candidate.tree !== review.tree ||
          identity.candidate.channel !== channel ||
          String(identity.run) !== String(review.evidenceRun) ||
          identity.viewport.width !== width ||
          identity.theme !== theme ||
          identity.density !== 1 ||
          identity.playwright !== '1.63.0' ||
          !/^ID=ubuntu$/m.test(identity.osRelease || '') ||
          !/^VERSION_ID="24.04"$/m.test(identity.osRelease || '')
        )
          throw Error('Capture provenance mismatch: ' + key)
        if (
          state === 'library-hidden' &&
          (identity.librarySurface?.attached !== false ||
            identity.librarySurface?.sidebarOpen !== false)
        )
          throw Error('Library was not fully hidden')
        if (browserVersion && browserVersion !== identity.browser)
          throw Error('Mixed browser versions')
        browserVersion = identity.browser
        if (repeat === 1) {
          files[key] = hash(raw)
          sidecars[sidecarKey] = get(`${channel}-${repeat}/visual-evidence/${sidecarKey}`)
        }
      }
}
const staging = `visual-evidence/channel-preparation-${channel}`
await fs.rm(staging, { recursive: true, force: true })
for (const key of Object.keys(files)) {
  await fs.mkdir(path.dirname(path.join(staging, key)), { recursive: true })
  await fs.writeFile(path.join(staging, key), get(`${channel}-1/visual-evidence/${key}`))
}
const manifest = {
  schema: 1,
  enabled: true,
  channel,
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
await fs.mkdir(output, { recursive: true })
await fs.cp(staging, output, { recursive: true })
for (const [key, raw] of Object.entries(sidecars)) {
  await fs.mkdir(path.dirname(path.join(history, key)), { recursive: true })
  await fs.writeFile(path.join(history, key), raw)
}
await fs.writeFile(path.join(history, 'review.json'), JSON.stringify(review, null, 2) + '\n')
for (const name of [
  `${channel}-summary.json`,
  `${channel}-1/candidate.json`,
  `${channel}-2/candidate.json`,
  `${channel}-1/visual-evidence/status.json`,
  `${channel}-2/visual-evidence/status.json`,
]) {
  const dest = path.join(history, name)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, get(name))
}
console.log(`Prepared 36 explicitly approved ${channel} baselines; original statuses retained`)

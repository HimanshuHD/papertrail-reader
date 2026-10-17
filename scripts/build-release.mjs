import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { validateTaggedPackages, packRelease, unpackRelease, sha256 } from './release-package.mjs'
import { writeCandidate } from './candidate-artifact.mjs'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const tag = process.env.RELEASE_TAG
const version = validateTaggedPackages(
  tag,
  JSON.parse(await readFile('package.json')),
  JSON.parse(await readFile('package-lock.json')),
)
const sha = git('rev-parse', `${tag}^{commit}`)
if (sha !== git('rev-parse', 'HEAD')) throw Error('Build checkout must be the exact tagged commit')
git('merge-base', '--is-ancestor', sha, 'origin/main')
if (
  !(await readFile('src/services/environment-storage.ts', 'utf8')).includes(
    ':release-${release[1]}',
  )
)
  throw Error(
    'Tagged app must support isolated versioned-release storage; historical tags are not repackaged',
  )
const basePath = process.env.BASE_PATH || '/papertrail-reader/'
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw Error('Invalid release base path')
const meta = {
  schema: 1,
  tag,
  version,
  sha,
  tree: git('rev-parse', 'HEAD^{tree}'),
  runId: String(process.env.GITHUB_RUN_ID),
  basePath,
}
// The trusted script is copied from main; source files/dependencies are the tagged revision.
await rm('release-build', { recursive: true, force: true })
for (const channel of ['versioned', 'production']) {
  const base = channel === 'versioned' ? `${basePath}releases/${tag}/` : basePath
  execFileSync('npm', ['exec', '--', 'vite', 'build', '--base', base], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_BUILD_SHA: sha,
      VITE_BRANCH_NAME: tag,
      VITE_PR_NUMBER: '',
      VITE_DEPLOY_CHANNEL: channel === 'versioned' ? 'release' : 'production',
    },
  })
  const folder = `release-build/${channel}`
  await mkdir(folder, { recursive: true })
  await cp('dist', folder, { recursive: true })
  await writeCandidate(folder, {
    sha,
    tree: meta.tree,
    headSha: sha,
    baseSha: '',
    runId: meta.runId,
    pr: '',
    channel: channel === 'versioned' ? 'release' : 'production',
    basePath: base,
    version,
    sourceBranch: tag,
    publish: true,
  })
}
await mkdir('release-output', { recursive: true })
const bytes = await packRelease('release-build', meta)
const filename = `papertrail-${tag}.json`
await unpackRelease(bytes, sha256(bytes), 'release-verified', meta)
await writeFile(`release-output/${filename}`, bytes)
await writeFile(`release-output/${filename}.sha256`, `${sha256(bytes)}  ${filename}\n`)
const notes = [`docs/releases/${tag}-notes.md`, `docs/releases/${tag}.md`]
let found = false
for (const file of notes) {
  try {
    await cp(file, 'release-output/RELEASE-NOTES.md')
    found = true
    break
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
if (!found) throw Error('Tagged revision must contain version-specific release notes')
console.log(`Verified ${tag} at ${sha}; packaging does not publish production`)

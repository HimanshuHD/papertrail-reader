import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, appendFile, writeFile, rm } from 'node:fs/promises'
import { writeCandidate } from './candidate-artifact.mjs'
import { affectsWebsite } from './deploy-policy.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const target = process.env.TARGET_BRANCH
if (!['main', 'staging'].includes(target)) throw new Error('Unsupported target branch')
const pr = process.env.PR_NUMBER || ''
const base = process.env.BASE_PATH || '/papertrail-reader/'
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid site base path')
const tree = git('rev-parse', 'HEAD^{tree}')
const sha = git('rev-parse', 'HEAD')
const headSha = process.env.HEAD_SHA || sha
const baseSha = process.env.BASE_SHA || ''
const paths = baseSha
  ? git('diff', '--no-renames', '--name-only', baseSha, 'HEAD').split('\n').filter(Boolean)
  : ['manual-recovery']
const publish = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || affectsWebsite(paths)
const version = JSON.parse(await readFile('package.json', 'utf8')).version
const branch = process.env.SOURCE_BRANCH || target
if (target === 'main' && pr) {
  if (!/^(release|hotfix)\//.test(branch))
    throw new Error('Main PRs require a release/* or hotfix/* branch')
  if (branch.startsWith('release/') && branch.slice(8).replace(/^v/, '') !== version)
    throw new Error('Release branch must match package version')
}
if (baseSha && pr) execFileSync('git', ['merge-base', '--is-ancestor', baseSha, headSha])
const channels = pr
  ? ['preview', target === 'main' ? 'production' : 'staging']
  : [target === 'main' ? 'production' : 'staging']
await rm('candidate', { recursive: true, force: true })
for (const channel of channels) {
  const basePath =
    channel === 'preview'
      ? `${base}preview/pr-${pr}/`
      : channel === 'staging'
        ? `${base}staging/`
        : base
  execFileSync('npm', ['exec', '--', 'vite', 'build', '--base', basePath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_BUILD_SHA: headSha,
      VITE_BRANCH_NAME: channel === 'preview' ? branch : target,
      VITE_PR_NUMBER: channel === 'preview' ? pr : '',
      VITE_DEPLOY_CHANNEL: channel,
    },
  })
  const folder = `candidate/${channel}`
  await mkdir(folder, { recursive: true })
  await cp('dist', folder, { recursive: true })
  await writeFile(
    folder + '/channel.json',
    JSON.stringify({ aligned: false, draft: false, productionVersion: '' }),
  )
  await writeCandidate(folder, {
    sha,
    tree,
    headSha,
    baseSha,
    runId: process.env.GITHUB_RUN_ID,
    pr,
    channel,
    basePath,
    version,
    sourceBranch: branch,
    publish,
  })
}

if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`)

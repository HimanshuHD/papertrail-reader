import fs from 'node:fs'
import { releaseVersion } from './release-package.mjs'
import { pathToFileURL } from 'node:url'

export function deploymentUrl(root, channel, pr, tag) {
  const base = new URL(root)
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid deployment URL')
  base.search = ''
  base.hash = ''
  if (!base.pathname.endsWith('/')) base.pathname += '/'
  if (channel === 'release') {
    releaseVersion(tag)
    return new URL(`releases/${tag}/`, base).href
  }
  if (channel === 'production') return base.href
  if (channel === 'staging') return new URL('staging/', base).href
  if (channel === 'preview' && /^[1-9]\d*$/.test(String(pr)))
    return new URL('preview/pr-' + pr + '/', base).href
  throw new Error('Invalid deployment channel or preview number')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = fs.existsSync('promotion-plan.json')
    ? JSON.parse(fs.readFileSync('promotion-plan.json', 'utf8'))
    : {}
  const release = fs.existsSync('release-plan.json')
    ? JSON.parse(fs.readFileSync('release-plan.json', 'utf8'))
    : null
  const channel =
    (release && (release.operation === 'archive-release' ? 'release' : 'production')) ||
    plan.channel ||
    (process.env.TARGET_BRANCH === 'staging' ? 'staging' : 'production')
  const url = deploymentUrl(process.env.SITE_URL, channel, plan.pr, release?.expected.tag)
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'site_url=' + url + '\n')
  console.log(channel + ' URL: ' + url)
}

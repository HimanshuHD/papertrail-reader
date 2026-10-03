import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { affectsWebsite } from './deploy-policy.mjs'
import { retiredPreviewHtml } from './retired-preview.mjs'
let publish = true
if (
  process.env.BUILD_EVENT === 'push' &&
  process.env.BEFORE_SHA &&
  !/^0+$/.test(process.env.BEFORE_SHA)
) {
  const paths = execFileSync(
    'git',
    ['diff', '--no-renames', '--name-only', '-z', process.env.BEFORE_SHA, process.env.GITHUB_SHA],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean)
  publish = affectsWebsite(paths)
}
fs.writeFileSync(
  'dist/build.json',
  JSON.stringify({ sha: process.env.SOURCE_SHA, runId: process.env.GITHUB_RUN_ID, publish }),
)

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${publish}\n`)
}

if (process.env.PR_NUMBER) {
  fs.writeFileSync(
    'dist/preview-closed.html',
    retiredPreviewHtml({ pr: process.env.PR_NUMBER, demo: true }),
  )
}

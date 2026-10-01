import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { affectsWebsite } from './deploy-policy.mjs'
let publish = true
if (
  process.env.BUILD_EVENT === 'push' &&
  process.env.BEFORE_SHA &&
  !/^0+$/.test(process.env.BEFORE_SHA)
) {
  const paths = execFileSync(
    'git',
    ['diff', '--name-only', process.env.BEFORE_SHA, process.env.GITHUB_SHA],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
  publish = affectsWebsite(paths)
}
fs.writeFileSync(
  'dist/build.json',
  JSON.stringify({ sha: process.env.SOURCE_SHA, runId: process.env.GITHUB_RUN_ID, publish }),
)

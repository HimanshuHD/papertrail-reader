import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browserContainerArgs, needsBrowserPreflight } from './browser-container-preflight.mjs'
const workflow = fs.readFileSync(
  new URL('../.github/workflows/browser-e2e.yml', import.meta.url),
  'utf8',
)
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

test('container preflight is limited to browser environment changes on ready staging CI', () => {
  assert.equal(needsBrowserPreflight(['src/App.vue', 'docs/README.md']), false)
  for (const path of [
    '.github/workflows/browser-e2e.yml',
    '.github/workflows/ci.yml',
    'scripts/browser-evidence.mjs',
    'scripts/browser-container-preflight.mjs',
  ])
    assert.equal(needsBrowserPreflight([path]), true)
  assert.match(
    ci,
    /name: Preflight changed browser container environment\n\s+if: github.event_name == 'pull_request' && github.event.pull_request.base.ref == 'staging'/,
  )
  assert.match(ci, /timeout-minutes: 5[\s\S]*BROWSER_PREFLIGHT_BASE_SHA/)
})

test('preflight runs actual three-engine evidence with an owned HOME and scoped Git trust', () => {
  const args = browserContainerArgs(workflow, '/workspace with spaces')
  assert.ok(args.includes('HOME=/root'))
  assert.ok(args.includes('GITHUB_WORKSPACE=/workspace'))
  assert.ok(args.includes('type=bind,source=/workspace with spaces,target=/workspace'))
  assert.ok(
    args.some((arg) =>
      /^mcr\.microsoft\.com\/playwright:v1\.63\.0-noble@sha256:[a-f0-9]{64}$/.test(arg),
    ),
  )
  const command = args.at(-1)
  assert.match(command, /statSync\(os.homedir\(\)\).uid!==process.getuid\(\)/)
  assert.match(command, /git config --global --add safe.directory "\$GITHUB_WORKSPACE"/)
  assert.match(workflow, /HOME=\/root node scripts\/browser-evidence.mjs/)
  assert.match(workflow, /HOME=\/root xvfb-run/)
  assert.match(workflow, /export HOME=\/root/)
  assert.match(command, /node scripts\/browser-evidence.mjs/)
  assert.doesNotMatch(command, /test:e2e|deploy|visual|safe.directory \*/)
  assert.throws(
    () => browserContainerArgs(workflow.replace('HOME: /root', 'HOME: /github/home'), '/workspace'),
    /owned HOME/,
  )
})

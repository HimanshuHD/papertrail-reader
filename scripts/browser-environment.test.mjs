import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const workflow = read('.github/workflows/browser-e2e.yml')

test('browser image and runtime guard match the exact locked Playwright dependency', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  const image = workflow.match(
    /image: mcr\.microsoft\.com\/playwright:v([^\s]+)-noble@sha256:([a-f0-9]{64})/,
  )
  assert.ok(image, 'use a versioned, digest-pinned official image')
  assert.equal(image[1], pkg.devDependencies['@playwright/test'])
  assert.equal(image[1], lock.packages['node_modules/@playwright/test'].version)
  assert.equal(workflow.match(/PLAYWRIGHT_IMAGE_VERSION: '([^']+)'/)[1], image[1])
  assert.match(workflow, /actual!==process\.env\.PLAYWRIGHT_IMAGE_VERSION/)
  assert.doesNotMatch(workflow, /playwright install/)
})

test('slow setup cannot consume the dedicated browser execution allowance or remove native focus', () => {
  const steps = workflow.split(/ {6}- name: /)
  const step = (name) => steps.find((value) => value.startsWith(name))
  const minutes = (value) => Number(value.match(/timeout-minutes: (\d+)/)[1])
  assert.equal(minutes(step('Install application dependencies')), 5)
  assert.equal(minutes(step('Install native focus window manager')), 5)
  assert.equal(minutes(step('Run browser acceptance')), 20)
  const windowManager = step('Install native focus window manager')
  assert.match(windowManager, /--no-install-recommends openbox/)
  assert.match(windowManager, /Acquire::Retries=1/)
  assert.match(windowManager, /Acquire::http::Timeout=30/)
  assert.match(windowManager, /Acquire::https::Timeout=30/)
  assert.doesNotMatch(windowManager, /sudo/)
  assert.match(
    step('Run browser acceptance'),
    /xvfb-run[\s\S]*openbox[\s\S]*npm run test:e2e -- --shard=/,
  )
  assert.match(workflow, /shard: \[1, 2\]/)
  for (const name of ['Upload browser evidence', 'Upload compact acceptance summary']) {
    assert.equal(minutes(step(name)), 3)
    assert.match(step(name), /if: always\(\)/)
  }
  const allocated = steps
    .slice(1)
    .filter((value) => /timeout-minutes:/.test(value))
    .reduce((sum, value) => sum + minutes(value), 0)
  assert.ok(
    allocated < minutes(workflow),
    'job reserves additional room for checkout/artifact setup',
  )
})

test('the actual runtime version guard passes matching installs and rejects image drift', () => {
  const code = workflow.match(/node -e "([\s\S]*?)"/)[1].replace(/\n\s*/g, ' ')
  const version = JSON.parse(read('package.json')).devDependencies['@playwright/test']
  const run = (expected) =>
    execFileSync(process.execPath, ['-e', code], {
      env: { ...process.env, PLAYWRIGHT_IMAGE_VERSION: expected },
      stdio: 'pipe',
    })
  run(version)
  assert.throws(
    () => run('0.0.0'),
    (error) =>
      error.status === 1 && error.stderr.toString().includes('Playwright/image version mismatch'),
  )
})

test('container shell trusts only its checked-out workspace before Git artifact verification', () => {
  const trust = workflow.match(
    /name: Trust checked-out workspace in container[\s\S]*?run: ([^\n]+)/,
  )[1]
  assert.equal(trust, 'git config --global --add safe.directory "$GITHUB_WORKSPACE"')
  assert.ok(
    workflow.indexOf('name: Trust checked-out workspace') >
      workflow.indexOf('ref: ${{ inputs.source_sha }}'),
  )
  assert.ok(
    workflow.indexOf('name: Trust checked-out workspace') <
      workflow.indexOf('name: Verify and serve'),
  )
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'papertrail-owner-'))
  const repo = path.join(root, "workspace with spaces and 'quotes'")
  const other = path.join(root, 'untrusted-repository')
  const home = path.join(root, 'shell-home')
  for (const directory of [repo, other, home]) fs.mkdirSync(directory)
  const cleanEnv = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: home,
    GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  }
  const git = (cwd, args, assumed = false) =>
    execFileSync('git', args, {
      cwd,
      env: { ...cleanEnv, GIT_TEST_ASSUME_DIFFERENT_OWNER: assumed ? '1' : '0' },
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim()
  try {
    for (const directory of [repo, other]) git(directory, ['init', '-q'])
    const rejected = (directory) =>
      assert.throws(
        () => git(directory, ['rev-parse', '--show-toplevel'], true),
        (error) => error.status !== 0 && error.stderr.toString().includes('dubious ownership'),
      )
    rejected(repo)
    git(home, ['config', '--global', '--add', 'safe.directory', repo])
    assert.equal(
      fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel'], true)),
      fs.realpathSync(repo),
    )
    rejected(other)
    assert.equal(git(home, ['config', '--global', '--get-all', 'safe.directory']), repo)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('candidate jobs skip checklist edits on merged and closed PRs but keep ready and manual validation', () => {
  const conditions = [...read('.github/workflows/ci.yml').matchAll(/^ {4}if: (.+)$/gm)].map(
    (match) => match[1],
  )
  assert.equal(conditions.length, 4)
  const allowed = (
    state,
    event,
    action = 'edited',
    ref = 'refs/heads/main',
    base = 'main',
    label = 'qa:visual',
    draft = false,
    sameRepo = true,
  ) => {
    const github = {
      event_name: event,
      ref,
      repository: 'owner/repo',
      event: {
        action,
        label: { name: label },
        changes: {},
        pull_request: {
          number: 176,
          state,
          draft,
          base: { ref: base },
          head: { repo: { full_name: sameRepo ? 'owner/repo' : 'foreign/repo' } },
        },
      },
    }
    const needs = { frontend: { outputs: { website: action === 'labeled' ? undefined : 'true' } } }
    return conditions.map((condition) =>
      new Function('github', 'needs', 'always', 'return (' + condition + ')')(
        github,
        needs,
        () => true,
      ),
    )
  }
  assert.deepEqual(allowed('closed', 'pull_request'), [false, false, false, false])
  assert.deepEqual(allowed('open', 'pull_request', 'synchronize'), [true, true, true, false])
  assert.deepEqual(allowed('open', 'pull_request'), [false, true, true, false])
  assert.deepEqual(allowed('closed', 'workflow_dispatch'), [true, true, true, false])
  assert.deepEqual(allowed('open', 'pull_request', 'labeled', 'refs/pull/176/merge', 'staging'), [
    false,
    false,
    false,
    true,
  ])
  for (const [state, base, label, draft, sameRepo] of [
    ['closed', 'staging', 'qa:visual', false, true],
    ['open', 'main', 'qa:visual', false, true],
    ['open', 'staging', 'type:enhancement', false, true],
    ['open', 'staging', 'qa:visual', true, true],
    ['open', 'staging', 'qa:visual', false, false],
  ])
    assert.deepEqual(
      allowed(
        state,
        'pull_request',
        'labeled',
        'refs/pull/176/merge',
        base,
        label,
        draft,
        sameRepo,
      ),
      [false, false, false, false],
    )

  assert.deepEqual(allowed('closed', 'workflow_dispatch', 'edited', 'refs/heads/staging'), [
    true,
    false,
    true,
    false,
  ])
  assert.deepEqual(allowed('open', 'pull_request', 'synchronize', 'refs/pull/176/merge'), [
    true,
    true,
    true,
    false,
  ])
})

test('ready-only CI validates both targets and gates production browser acceptance', () => {
  const ci = read('.github/workflows/ci.yml')
  assert.match(ci, /branches: \[main, staging\]/)
  assert.match(
    ci,
    /types: \[opened, ready_for_review, synchronize, reopened, converted_to_draft, edited, labeled\]/,
  )
  assert.match(ci, /github.event.pull_request.draft == false/)
  assert.match(ci, /name: Candidate validation/)
  assert.match(ci, /name: candidate-build/)
  assert.ok(!ci.includes('  push:'))
  assert.ok(!ci.includes('uses: ./.github/workflows/pages.yml'))
})

test('browser accepts prebuilt artifacts instead of rebuilding and preserves native cross-browser evidence', () => {
  const browser = read('.github/workflows/browser-e2e.yml')
  assert.match(browser, /workflow_call:/)
  assert.match(browser, /name: candidate-build/)
  assert.match(browser, /verifyCandidate/)
  assert.ok(!browser.includes('npm run build'))
  assert.match(browser, /shard: \[1, 2\]/)
  assert.match(browser, /chromium firefox webkit/)
  assert.match(browser, /xvfb-run/)
  assert.match(browser, /browser-summary-/)
})

test('serialized publication preserves trusted cleanup, fresh candidate checks and post-verification receipts', () => {
  const pages = read('.github/workflows/pages.yml')
  assert.match(pages, /queue: max/)
  assert.match(pages, /cancel-in-progress: false/)
  assert.match(pages, /pull_request_target:/)
  assert.match(pages, /types: \[closed, converted_to_draft, reopened\]/)
  assert.match(pages, /Recheck branch freshness/)
  assert.ok(
    pages.indexOf('node scripts/verify-live.mjs') <
      pages.indexOf('node scripts/acknowledge-publication.mjs'),
  )
  const delivery = read('.github/workflows/channel-delivery.yml')
  assert.match(delivery, /needs.browser.result == 'success'/)
  assert.match(delivery, /node scripts\/verify-delivery.mjs/)
})

test('main identity reports docs-only false, application true, and renamed source true', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'papertrail-build-info-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  const commit = () => {
    git('add', '-A')
    git('commit', '-qm', 'fixture')
    return git('rev-parse', 'HEAD')
  }
  try {
    git('init', '-q')
    git('config', 'user.name', 'Pipeline test')
    git('config', 'user.email', 'test@example.invalid')
    fs.mkdirSync(path.join(dir, 'docs'))
    fs.mkdirSync(path.join(dir, 'src'))
    fs.mkdirSync(path.join(dir, 'dist'))
    fs.writeFileSync(path.join(dir, '.gitignore'), 'dist/\noutput\n')
    fs.writeFileSync(path.join(dir, 'src', 'App.vue'), 'application')
    let before = commit()
    const run = (beforeSha, sha, expected) => {
      const output = path.join(dir, 'output')
      fs.writeFileSync(output, '')
      execFileSync(process.execPath, [path.join(root, 'scripts/build-info.mjs')], {
        cwd: dir,
        env: {
          ...process.env,
          BUILD_EVENT: 'push',
          BEFORE_SHA: beforeSha,
          GITHUB_SHA: sha,
          SOURCE_SHA: sha,
          GITHUB_RUN_ID: '123',
          GITHUB_OUTPUT: output,
          PR_NUMBER: '',
        },
      })
      const identity = JSON.parse(fs.readFileSync(path.join(dir, 'dist/build.json'), 'utf8'))
      assert.deepEqual(identity, { sha, runId: '123', publish: expected })
      assert.equal(fs.readFileSync(output, 'utf8'), 'publish=' + expected + '\n')
    }
    fs.writeFileSync(path.join(dir, 'docs', 'progress.md'), 'tracker')
    let sha = commit()
    run(before, sha, false)
    before = sha
    fs.writeFileSync(path.join(dir, 'src', 'App.vue'), 'updated application')
    sha = commit()
    run(before, sha, true)
    before = sha
    git('mv', 'src/App.vue', 'docs/renamed.md')
    sha = commit()
    run(before, sha, true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('visual and unrelated label runs cannot cancel current frontend candidate validation', () => {
  const expression = read('.github/workflows/ci.yml').match(
    /group: frontend-ci-\$\{\{ (.+) \}\}/,
  )[1]
  const group = new Function('github', 'format', 'return (' + expression + ')')
  const github = {
    run_id: 42,
    ref: 'refs/pull/176/merge',
    event: {
      action: 'synchronize',
      changes: {},
      label: { name: '' },
      pull_request: { number: 176 },
    },
  }
  const format = (template, value) => template.replace('{0}', value)
  assert.equal(group(github, format), 176)
  github.event.action = 'labeled'
  github.event.label.name = 'qa:visual'
  assert.equal(group(github, format), 'visual-176')
  github.event.label.name = 'type:enhancement'
  assert.equal(group(github, format), 'metadata-42')
  github.run_id = 43
  assert.equal(group(github, format), 'metadata-43')
})

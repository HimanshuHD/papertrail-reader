import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { affectsWebsite } from './deploy-policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('required frontend CI remains unconditional and automatic publication depends on its artifact', () => {
  const ci = read('.github/workflows/ci.yml')
  const pages = read('.github/workflows/pages.yml')
  assert.ok(!ci.includes('paths-ignore:'))
  assert.match(ci, /needs: frontend/)
  assert.match(ci, /needs.frontend.outputs.publish == 'true'/)
  assert.match(ci, /uses: .\/\.github\/workflows\/pages.yml/)
  assert.match(ci, /publish: \$\{\{ steps.identity.outputs.publish \}\}/)
  assert.ok(!pages.includes('workflow_run:'))
  assert.match(pages, /workflow_call:/)
  assert.match(pages, /workflow_dispatch:/)
  assert.match(pages, /process.env.BUILD_RUN !== String\(context.runId\)/)
  assert.match(pages, /Artifact identity mismatch/)
  assert.match(pages, /cancel-in-progress: false/)
  assert.match(ci, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/)
})

test('browser filters preserve manual acceptance, ready updates and whole-PR application changes', () => {
  const browser = read('.github/workflows/browser-e2e.yml')
  assert.match(browser, /types: \[opened, synchronize, reopened, ready_for_review\]/)
  assert.match(browser, /workflow_dispatch:/)
  assert.match(browser, /github.event.pull_request.draft == false/)
  assert.ok(!browser.includes('\n  push:'))
  const patterns = [...browser.matchAll(/^ {6}- '([^']+)'$/gm)].map((m) => m[1])
  const ignored = (p) =>
    patterns.some((pattern) => {
      if (pattern.endsWith('/**')) return p.startsWith(pattern.slice(0, -2))
      if (pattern.endsWith('.*')) return p.startsWith(pattern.slice(0, -1)) && !p.includes('/')
      return pattern === p
    })
  for (const paths of [
    ['docs/roadmap.md', 'README.md'],
    ['docs/progress.md'],
    ['.github/ISSUE_TEMPLATE/bug.yml', '.gitignore'],
    ['src/App.vue', 'docs/guide.md'],
    ['package-lock.json'],
    ['.github/workflows/browser-e2e.yml'],
    ['tests/e2e/shell.spec.ts'],
    ['unknown.config'],
  ])
    assert.equal(
      paths.some((p) => !ignored(p)),
      affectsWebsite(paths),
    )
  // A later docs-only commit must not hide application files already present in the PR diff.
  assert.equal(
    ['src/App.vue', 'docs/later.md'].some((p) => !ignored(p)),
    true,
  )
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

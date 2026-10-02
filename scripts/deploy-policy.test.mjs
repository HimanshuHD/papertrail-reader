import test from 'node:test'
import assert from 'node:assert/strict'
import { affectsWebsite, previewDecision, eligibleMainBuild } from './deploy-policy.mjs'
test('website changes publish, documentation-only changes do not', () => {
  assert.equal(
    affectsWebsite(['docs/roadmap.md', 'README.md', '.github/ISSUE_TEMPLATE/bug.yml']),
    false,
  )
  for (const p of [
    'src/App.vue',
    'package-lock.json',
    'vite.config.ts',
    'public/icon.svg',
    '.github/workflows/pages.yml',
    'scripts/deploy-policy.mjs',
  ])
    assert.equal(affectsWebsite(['docs/a.md', p]), true)
})
test('open PRs publish only manually; closed previews retire; stale and fork builds skip', () => {
  const p = {
    manual: false,
    state: 'open',
    currentSha: 'a',
    buildSha: 'a',
    sameRepo: true,
    target: 'main',
  }
  assert.equal(previewDecision(p), 'skip')
  assert.equal(previewDecision({ ...p, manual: true }), 'preview')
  assert.equal(previewDecision({ ...p, state: 'closed' }), 'retire')
  assert.throws(() => previewDecision({ ...p, manual: true, state: 'closed' }), /open PR/)
  assert.equal(previewDecision({ ...p, manual: true, buildSha: 'old' }), 'skip')
  assert.equal(previewDecision({ ...p, manual: true, sameRepo: false }), 'skip')
})

test('main publication tolerates tracker-only descendants but rejects superseded website builds', () => {
  const b = {
    buildSha: 'a',
    mainSha: 'b',
    status: 'ahead',
    files: [{ filename: 'docs/progress.md' }],
  }
  assert.equal(eligibleMainBuild(b), true)
  assert.equal(eligibleMainBuild({ ...b, mainSha: 'a' }), true)
  assert.equal(eligibleMainBuild({ ...b, status: 'diverged' }), false)
  assert.equal(eligibleMainBuild({ ...b, files: [{ filename: 'src/App.vue' }] }), false)
  assert.equal(
    eligibleMainBuild({
      ...b,
      files: [{ filename: 'docs/moved.md', previous_filename: 'src/App.vue' }],
    }),
    false,
  )
  assert.equal(
    eligibleMainBuild({ ...b, files: Array(300).fill({ filename: 'docs/a.md' }) }),
    false,
  )
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  selectVisualCandidate,
  assertVisualPR,
  verifyVisualArtifact,
  visualProfile,
} from './visual-qa-policy.mjs'
import { writeCandidate } from './candidate-artifact.mjs'
import { validateBaselines } from './visual-baselines.mjs'
const base = 'a'.repeat(40),
  head = 'b'.repeat(40),
  source = 'c'.repeat(40),
  tree = 'd'.repeat(40)
function fixture({ pull = {}, run = {}, jobs, artifacts, merge = {}, comparison } = {}) {
  const pr = {
    number: 177,
    state: 'open',
    draft: false,
    head: { sha: head, ref: 'feat/test', repo: { full_name: 'owner/repo' } },
    base: { ref: 'staging', sha: base },
    merge_commit_sha: source,
    ...pull,
  }
  const workflow = {
    id: 42,
    event: 'pull_request',
    path: '.github/workflows/ci.yml',
    head_sha: head,
    head_branch: 'feat/test',
    head_repository: { full_name: 'owner/repo' },
    pull_requests: [{ number: 177 }],
    conclusion: 'success',
    status: 'completed',
    ...run,
  }
  const github = {
    paginate: async (method, args) => (await method(args)).data,
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      repos: {
        getBranch: async () => ({ data: { commit: { sha: base } } }),
        compareCommits: async () => ({ data: { merge_base_commit: { sha: comparison || base } } }),
        getContent: async () => {
          throw Object.assign(Error('Missing'), { status: 404 })
        },
      },
      git: {
        getCommit: async () => ({
          data: { tree: { sha: tree }, parents: [{ sha: base }, { sha: head }], ...merge },
        }),
      },
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: [workflow] } }),
        getWorkflowRun: async () => ({ data: workflow }),
        listWorkflowRunArtifacts: async () => ({
          data: artifacts || [{ name: 'candidate-build', expired: false }],
        }),
        listJobsForWorkflowRun: async () => ({
          data: jobs || [
            { name: 'Candidate validation', conclusion: 'success' },
            { name: 'Validate and build website', conclusion: 'success' },
          ],
        }),
      },
    },
  }
  return { github, owner: 'owner', repo: 'repo', prNumber: 177 }
}
test('accepts only current ready candidate and rechecks against source movement', async () => {
  const options = fixture(),
    plan = await selectVisualCandidate(options)
  assert.equal(plan.sourceSha, source)
  assert.equal(plan.runId, '42')
  await assertVisualPR({ ...options, plan })
  await assert.rejects(
    assertVisualPR({
      ...fixture({
        pull: { head: { sha: source, ref: 'feat/test', repo: { full_name: 'owner/repo' } } },
        merge: { parents: [{ sha: base }, { sha: source }] },
      }),
      plan,
    }),
    /changed/,
  )
})
test('rejects draft closed fork main stale branch merge workflow gate and PR provenance', async () => {
  for (const options of [
    { pull: { draft: true } },
    { pull: { state: 'closed' } },
    { pull: { head: { sha: head, repo: { full_name: 'fork/repo' } } } },
    { pull: { base: { ref: 'main', sha: base } } },
    { pull: { base: { ref: 'staging', sha: source } } },
    { comparison: source },
    { merge: { parents: [{ sha: base }, { sha: source }] } },
    { run: { path: '.github/workflows/fake.yml' } },
    { run: { event: 'workflow_dispatch' } },
    { run: { head_sha: source } },
    { run: { head_branch: 'other' } },
    { run: { pull_requests: [] } },
    { jobs: [{ name: 'Candidate validation', conclusion: 'skipped' }] },
    { run: { head_repository: { full_name: 'fork/repo' } } },
  ])
    await assert.rejects(selectVisualCandidate(fixture(options)))
})
test('verifies real candidate bytes and rejects identity tampering', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-candidate-'))
  try {
    const plan = await selectVisualCandidate(fixture())
    await fs.writeFile(path.join(folder, 'index.html'), 'real candidate')
    const identity = { ...plan, sha: source, basePath: '/papertrail-reader/preview/pr-177/' }
    await writeCandidate(folder, identity)
    assert.equal((await verifyVisualArtifact(folder, plan)).sha, source)
    for (const change of [
      { headSha: source },
      { baseSha: head },
      { tree: head },
      { runId: '43' },
      { pr: '178' },
      { sourceSha: head },
    ])
      await assert.rejects(verifyVisualArtifact(folder, { ...plan, ...change }))
    await fs.writeFile(path.join(folder, 'index.html'), 'tampered')
    await assert.rejects(verifyVisualArtifact(folder, plan), /checksum/)
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
})
test('unapproved baseline cannot activate strict comparisons; incomplete approved sets fail', async () => {
  const committed = await validateBaselines()
  assert.equal(committed.enabled, false)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-baseline-'))
  try {
    await fs.writeFile(
      path.join(root, 'approval.json'),
      JSON.stringify({ schema: 1, enabled: false, files: {} }),
    )
    assert.equal((await validateBaselines(root)).enabled, false)
    await fs.writeFile(
      path.join(root, 'approval.json'),
      JSON.stringify({ schema: 1, enabled: true, files: {} }),
    )
    await assert.rejects(validateBaselines(root), /approval/)
    await fs.writeFile(
      path.join(root, 'approval.json'),
      JSON.stringify({
        schema: 1,
        enabled: true,
        profile: 'startup',
        approval: {
          owner: 'HimanshuHD',
          reviewUrl: 'https://github.com/HimanshuHD/papertrail-reader/pull/176#issuecomment-1',
          sourceSha: head,
          evidenceRun: '42',
          reviewedAt: '2026-10-13',
        },
        environment: {
          os: 'ubuntu-24.04',
          playwright: '1.63.0',
          browser: 'chromium',
          browserVersion: '153.0.8010.12',
          density: 1,
        },
        files: {},
      }),
    )
    await assert.rejects(validateBaselines(root), /incomplete/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('manual comparison accepts a completed functional candidate despite previous visual failure', async () => {
  for (const conclusion of ['success', 'failure', 'cancelled']) {
    const plan = await selectVisualCandidate(fixture({ run: { conclusion } }))
    assert.equal(plan.runId, '42')
    assert.equal(plan.acceptance, 'completed-candidate-gate-passed')
  }
})
test('manual selection rejects pending candidates and failed or skipped required checks', async () => {
  for (const change of [
    { run: { status: 'in_progress', conclusion: null } },
    { run: { status: 'queued', conclusion: null } },
    { jobs: [{ name: 'Candidate validation', conclusion: 'failure' }] },
    { jobs: [{ name: 'Candidate validation', conclusion: 'skipped' }] },
    {
      jobs: [
        { name: 'Candidate validation', conclusion: 'success' },
        { name: 'Validate and build website', conclusion: 'failure' },
      ],
    },
    { artifacts: [] },
    { artifacts: [{ name: 'candidate-build', expired: true }] },
  ])
    await assert.rejects(selectVisualCandidate(fixture(change)))
})
test('manual channel selection is bound to the actual PR destination artifact', async () => {
  assert.equal(
    (await selectVisualCandidate({ ...fixture(), channel: 'staging' })).channel,
    'staging',
  )
  await assert.rejects(selectVisualCandidate({ ...fixture(), channel: 'production' }), /channel/)
  await assert.rejects(selectVisualCandidate({ ...fixture(), channel: 'unknown' }), /channel/)
  for (const ref of ['release/2.1.0', 'hotfix/visual-qa']) {
    const options = fixture({
      pull: {
        base: { ref: 'main', sha: base },
        head: { sha: head, ref, repo: { full_name: 'owner/repo' } },
      },
      run: { head_branch: ref },
    })
    const plan = await selectVisualCandidate({ ...options, channel: 'production' })
    assert.equal(plan.branch, 'main')
    assert.equal(plan.channel, 'production')
    await assert.rejects(selectVisualCandidate({ ...options, channel: 'staging' }), /channel/)
  }
})
test('channel artifacts enforce their own base paths and cannot borrow preview bytes', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-channels-'))
  try {
    for (const channel of ['staging', 'production']) {
      const options =
        channel === 'staging'
          ? fixture()
          : fixture({
              pull: {
                base: { ref: 'main', sha: base },
                head: { sha: head, ref: 'hotfix/test', repo: { full_name: 'owner/repo' } },
              },
              run: { head_branch: 'hotfix/test' },
            })
      const plan = await selectVisualCandidate({ ...options, channel })
      const basePath = channel === 'staging' ? '/papertrail-reader/staging/' : '/papertrail-reader/'
      await fs.writeFile(path.join(folder, 'index.html'), 'channel candidate')
      await writeCandidate(folder, { ...plan, sha: source, basePath })
      assert.equal((await verifyVisualArtifact(folder, plan)).channel, channel)
      await assert.rejects(verifyVisualArtifact(folder, { ...plan, channel: 'preview' }))
      await writeCandidate(folder, { ...plan, sha: source, basePath: '/wrong/' })
      await assert.rejects(verifyVisualArtifact(folder, plan))
    }
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
})
test('auto profile chooses the artifact startup surface; shell fallback and explicit profiles remain available', () => {
  assert.equal(visualProfile('auto', '<section id="startup-loading">'), 'startup')
  assert.equal(visualProfile('auto', '<section id=startup-loading class=x>'), 'startup')
  assert.equal(visualProfile('auto', '<div id="app">'), 'shell')
  assert.equal(visualProfile('startup', '<div id="app">'), 'startup')
  assert.equal(visualProfile('shell', '<section id="startup-loading">'), 'shell')
  assert.throws(() => visualProfile('invalid', ''), /Invalid/)
})

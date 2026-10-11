import test from 'node:test'
import assert from 'node:assert/strict'
import { previewEligible, selectCandidate, closedPreviews } from './delivery-policy.mjs'

const sha = 'a'.repeat(40),
  head = 'b'.repeat(40),
  tree = 'c'.repeat(40)
const pr = {
  number: 170,
  state: 'open',
  draft: false,
  base: { ref: 'staging', sha },
  head: { sha: head, ref: 'feature/book', repo: { full_name: 'owner/repo' } },
  merge_commit_sha: sha,
  merged_at: '2026-10-11',
}
function fixture({
  state,
  run = {},
  artifacts = [{ name: 'candidate-build', expired: false }],
  pull = pr,
  comparison = { status: 'ahead', files: [{ filename: 'src/App.vue' }] },
} = {}) {
  const workflow = {
    id: 42,
    event: 'pull_request',
    conclusion: 'success',
    head_branch: 'feature/book',
    head_sha: head,
    head_repository: { full_name: 'owner/repo' },
    ...run,
  }
  const github = {
    paginate: async (method, args) => (await method(args)).data,
    rest: {
      repos: {
        getBranch: async () => ({ data: { commit: { sha, commit: { tree: { sha: tree } } } } }),
        listPullRequestsAssociatedWithCommit: async () => ({ data: [pull] }),
        getContent: async () => {
          if (!state) throw Object.assign(new Error('Missing'), { status: 404 })
          return { data: { content: Buffer.from(JSON.stringify(state)).toString('base64') } }
        },
        compareCommits: async () => ({ data: comparison }),
      },
      pulls: { get: async () => ({ data: pull }) },
      git: { getCommit: async () => ({ data: { tree: { sha: tree } } }) },
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: [workflow] } }),
        getWorkflowRun: async () => ({ data: workflow }),
        listWorkflowRunArtifacts: async () => ({ data: artifacts }),
      },
    },
  }
  return { github, owner: 'owner', repo: 'repo', branch: 'staging' }
}

test('preview eligibility covers staging, release and hotfix, rejects drafts/forks/arbitrary main branches', () => {
  assert.equal(previewEligible(pr, 'owner/repo'), true)
  for (const ref of ['release/2.1.0', 'hotfix/reader'])
    assert.equal(
      previewEligible({ ...pr, base: { ref: 'main' }, head: { ...pr.head, ref } }, 'owner/repo'),
      true,
    )
  for (const pull of [
    { ...pr, draft: true },
    { ...pr, state: 'closed' },
    { ...pr, head: { ...pr.head, repo: { full_name: 'foreign/repo' } } },
    { ...pr, base: { ref: 'main' } },
  ])
    assert.equal(previewEligible(pull, 'owner/repo'), false)
})

test('selects current validated content and rejects superseded branch events', async () => {
  const plan = await selectCandidate(fixture())
  assert.equal(plan.channel, 'staging')
  assert.equal(plan.tree, tree)
  assert.equal(plan.headSha, head)
  assert.equal((await selectCandidate({ ...fixture(), sourceSha: head })).skip, true)
})

test('failed or expired CI artifacts cannot promote', async () => {
  for (const options of [
    { run: { conclusion: 'failure' } },
    { artifacts: [{ name: 'candidate-build', expired: true }] },
    { run: { head_repository: { full_name: 'foreign/repo' } } },
  ])
    await assert.rejects(selectCandidate(fixture(options)), /No successful/)
})

test('rollback hold blocks automatic repromotion; manual recovery still requires validated current source', async () => {
  const state = { staging: { sourceSha: head }, rollbackHold: { staging: sha } }
  assert.match((await selectCandidate(fixture({ state }))).reason, /Rollback hold/)
  await assert.rejects(
    selectCandidate({
      ...fixture({
        run: {
          event: 'workflow_dispatch',
          head_branch: 'staging',
          head_sha: head,
          path: '.github/workflows/ci.yml',
        },
      }),
      manualRun: 42,
    }),
    /Invalid manual/,
  )
})

test('already-saved and documentation-only branch heads do not redeploy', async () => {
  assert.equal(
    (await selectCandidate(fixture({ state: { staging: { sourceSha: sha } } }))).skip,
    true,
  )
  assert.equal(
    (
      await selectCandidate(
        fixture({
          state: { staging: { sourceSha: head } },
          comparison: { status: 'ahead', files: [{ filename: 'docs/deployment/publishing.md' }] },
        }),
      )
    ).skip,
    true,
  )
})

test('closed published previews retire while an open draft stays published', async () => {
  const input = fixture({ pull: { ...pr, state: 'closed' } })
  assert.deepEqual(
    await closedPreviews(input.github, 'owner', 'repo', {
      previews: { 170: { status: 'active' }, 171: { status: 'retired' } },
    }),
    [170],
  )
  const open = fixture({ pull: { ...pr, draft: true } })
  assert.deepEqual(
    await closedPreviews(open.github, 'owner', 'repo', { previews: { 170: { status: 'active' } } }),
    [],
  )
})

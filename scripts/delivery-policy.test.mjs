import test from 'node:test'
import assert from 'node:assert/strict'
import {
  previewEligible,
  selectCandidate,
  closedPreviews,
  waitForCandidate,
} from './delivery-policy.mjs'

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
  receipt = state,
  run = {},
  artifacts = [{ name: 'candidate-build', expired: false }],
  pull = pr,
  comparison = { status: 'ahead', files: [{ filename: 'src/App.vue' }] },
  publishedTree = 'd'.repeat(40),
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
        getContent: async ({ path }) => {
          const value = path === '.publication-receipt.json' ? receipt : state
          if (!value) throw Object.assign(new Error('Missing'), { status: 404 })
          return { data: { content: Buffer.from(JSON.stringify(value)).toString('base64') } }
        },
        compareCommits: async () => ({ data: comparison }),
      },
      pulls: { get: async () => ({ data: pull }) },
      git: {
        getCommit: async ({ commit_sha }) => ({
          data: { tree: { sha: commit_sha === head ? publishedTree : tree } },
        }),
      },
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

test('history-only staging sync skips before requiring a PR or candidate', async () => {
  const input = fixture({ state: { staging: { sourceSha: head } }, publishedTree: tree })
  input.github.rest.repos.listPullRequestsAssociatedWithCommit = async () => {
    assert.fail('Unchanged published tree must not require a merged PR')
  }
  input.github.rest.actions.listWorkflowRuns = async () => {
    assert.fail('History-only sync must not build or select an artifact')
  }
  const result = await selectCandidate({ ...input, sourceSha: sha })
  assert.equal(result.skip, true)
  assert.match(result.reason, /History-only staging/)
})

test('changed, divergent, unrecorded or unknown published content cannot bypass PR validation', async () => {
  for (const options of [
    { state: { staging: { sourceSha: head } } },
    {
      state: { staging: { sourceSha: head } },
      publishedTree: tree,
      comparison: { status: 'diverged', files: [] },
    },
    { publishedTree: tree },
    { state: { staging: {} }, publishedTree: tree },
    { state: { staging: { sourceSha: head } }, publishedTree: null },
    { state: { staging: { sourceSha: head } }, publishedTree: tree, receipt: null },
    {
      state: { staging: { sourceSha: head } },
      publishedTree: tree,
      receipt: { staging: { sourceSha: sha } },
    },
  ]) {
    const input = fixture(options)
    input.github.rest.repos.listPullRequestsAssociatedWithCommit = async () => ({ data: [] })
    await assert.rejects(selectCandidate(input), /No validated merged PR/)
  }
})

test('history-only shortcut does not apply to previews, main or manual recovery', async () => {
  const input = fixture({
    state: { staging: { sourceSha: head }, production: { sourceSha: head } },
    publishedTree: tree,
  })
  assert.equal((await selectCandidate({ ...input, prNumber: 170 })).channel, 'preview')
  await assert.rejects(selectCandidate({ ...input, branch: 'main' }), /No validated merged PR/)
  await assert.rejects(selectCandidate({ ...input, manualRun: 42 }), /Invalid manual/)
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

test('metadata validation waits for full CI then reuses its accepted artifact', async () => {
  const input = fixture()
  let polls = 0
  input.github.rest.actions.listWorkflowRuns = async () => ({
    data: {
      workflow_runs:
        ++polls < 3
          ? []
          : [{ id: 42, conclusion: 'success', head_repository: { full_name: 'owner/repo' } }],
    },
  })
  let waits = 0
  const plan = await waitForCandidate(
    { ...input, prNumber: 170, expectedHead: head, expectedBase: sha },
    {
      attempts: 3,
      pause: async () => {
        waits++
      },
    },
  )
  assert.equal(plan.runId, '42')
  assert.equal(waits, 2)
})

test('metadata validation cannot accept failed artifacts and stops at the retry limit', async () => {
  let waits = 0
  await assert.rejects(
    waitForCandidate(
      {
        ...fixture({ run: { conclusion: 'failure' } }),
        prNumber: 170,
        expectedHead: head,
        expectedBase: sha,
      },
      {
        attempts: 2,
        pause: async () => {
          waits++
        },
      },
    ),
    /No successful/,
  )
  assert.equal(waits, 1)
})

test('metadata validation immediately rejects changed source and ineligible PRs', async () => {
  for (const input of [
    { ...fixture(), expectedHead: sha },
    { ...fixture({ pull: { ...pr, draft: true } }), expectedHead: head },
  ])
    await assert.rejects(
      waitForCandidate(
        { ...input, prNumber: 170, expectedBase: sha },
        {
          pause: async () => {
            assert.fail('Invalid source must not wait')
          },
        },
      ),
      /changed|ready/,
    )
})

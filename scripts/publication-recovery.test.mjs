import test from 'node:test'
import assert from 'node:assert/strict'
import { recoverPublication } from './publication-recovery.mjs'

const state = {
  production: { sha: 'main', runId: 20 },
  previews: {
    7: { sha: 'preview', runId: 21, status: 'active' },
    8: { sha: 'preview-8', runId: 22, status: 'active' },
  },
}
function fixture({
  saved = state,
  receipt = state,
  runs,
  failed = false,
  expired = false,
  comparison,
} = {}) {
  const calls = []
  const candidates = runs || [
    {
      id: 30,
      head_sha: 'main',
      head_branch: 'main',
      event: 'push',
      conclusion: 'cancelled',
      head_repository: { full_name: 'owner/repo' },
    },
  ]
  const jobs = async () => [
    { name: 'Validate and build website', conclusion: failed ? 'failure' : 'success' },
  ]
  const artifacts = async () => [{ name: 'web-build', expired }]
  const github = {
    paginate: (method, args) => method(args),
    rest: {
      repos: {
        getContent: async ({ path }) => {
          const value = path === '.deployment-state.json' ? saved : receipt
          if (!value) throw Object.assign(new Error('Missing'), { status: 404 })
          return { data: { content: Buffer.from(JSON.stringify(value)).toString('base64') } }
        },
        getBranch: async () => ({ data: { commit: { sha: 'main' } } }),
        compareCommits: async () => ({
          data: comparison || { status: 'ahead', files: [{ filename: 'src/App.vue' }] },
        }),
      },
      pulls: {
        get: async ({ pull_number }) => ({
          data: { state: pull_number === 7 ? 'closed' : 'open' },
        }),
      },
      actions: {
        listWorkflowRuns: async (args) => {
          calls.push(args)
          return { data: { workflow_runs: candidates } }
        },
        listJobsForWorkflowRun: jobs,
        listWorkflowRunArtifacts: artifacts,
      },
    },
  }
  return { github, owner: 'owner', repo: 'repo', calls }
}

test('recovers a successful frontend artifact despite a cancelled publisher', async () => {
  const input = fixture({ saved: null, receipt: null })
  const plan = await recoverPublication(input)
  assert.equal(plan.outputs.kind, 'production')
  assert.equal(plan.outputs.run_id, '30')
  assert.equal(input.calls[0].workflow_id, 'ci.yml')
  assert.equal(input.calls[0].status, 'completed')
})

test('closed previews reconcile without replacing production or open previews', async () => {
  const plan = await recoverPublication(fixture())
  assert.equal(plan.outputs.kind, 'reconcile')
  assert.deepEqual(plan.retirePRs, [7])
})

test('failed deployment without receipt republishes an unchanged saved aggregate', async () => {
  const saved = { ...state, previews: {} }
  const plan = await recoverPublication(fixture({ saved, receipt: null, expired: true }))
  assert.equal(plan.outputs.kind, 'reconcile')
})

test('acknowledged deployment is a no-op', async () => {
  const saved = { ...state, previews: {} }
  const plan = await recoverPublication(fixture({ saved, receipt: saved }))
  assert.equal(plan.outputs.skip, 'true')
})

test('rejects failed frontend, expired artifact, foreign repository and stale website build', async () => {
  const run = {
    id: 30,
    head_sha: 'main',
    head_branch: 'main',
    event: 'push',
    head_repository: { full_name: 'owner/repo' },
  }
  for (const options of [
    { failed: true },
    { expired: true },
    { runs: [{ ...run, head_repository: { full_name: 'foreign/repo' } }] },
    { runs: [{ ...run, head_sha: 'old' }] },
    { runs: [{ ...run, event: 'pull_request' }] },
  ]) {
    const plan = await recoverPublication(fixture({ saved: null, receipt: null, ...options }))
    assert.equal(plan.outputs.skip, 'true')
  }
})

test('allows verified documentation-only descendants but rejects unknown comparisons', async () => {
  const runs = [
    {
      id: 30,
      head_sha: 'old',
      head_branch: 'main',
      event: 'push',
      head_repository: { full_name: 'owner/repo' },
    },
  ]
  const plan = await recoverPublication(
    fixture({
      saved: null,
      receipt: null,
      runs,
      comparison: { status: 'ahead', files: [{ filename: 'docs/deployment/publishing.md' }] },
    }),
  )
  assert.equal(plan.outputs.sha, 'old')
  const denied = await recoverPublication(
    fixture({ saved: null, receipt: null, runs, comparison: { status: 'diverged', files: [] } }),
  )
  assert.equal(denied.outputs.skip, 'true')
})

test('API errors are visible failures, not false successful acknowledgments', async () => {
  const input = fixture()
  input.github.rest.repos.getContent = async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  await assert.rejects(recoverPublication(input), /Forbidden/)
})

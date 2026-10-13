import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { visualQaOnlyRun } from './visual-qa-smoke.mjs'
const smoke = { name: 'Visual QA smoke (PR #176) / capture', conclusion: 'success' }
function fixture(jobs = [smoke], artifacts = []) {
  return {
    owner: 'owner',
    repo: 'repo',
    runId: 42,
    github: {
      paginate: async (method, args) => (await method(args)).data,
      rest: {
        actions: {
          listJobsForWorkflowRun: async () => ({ data: jobs }),
          listWorkflowRunArtifacts: async () => ({ data: artifacts }),
        },
      },
    },
  }
}
test('QA-only successful manual run skips publication; a validated recovery build is never classified as smoke-only', async () => {
  assert.equal(await visualQaOnlyRun(fixture()), true)
  for (const options of [
    fixture([]),
    fixture([{ ...smoke, conclusion: 'failure' }]),
    fixture([smoke, { name: 'Candidate validation', conclusion: 'success' }]),
    fixture([smoke, { name: 'Validate and build website', conclusion: 'success' }]),
    fixture([smoke], [{ name: 'candidate-build', expired: false }]),
  ])
    assert.equal(await visualQaOnlyRun(options), false)
})
test('smoke routes an explicit same-repository ready staging PR label through approved staging tooling', async () => {
  const ci = await fs.readFile('.github/workflows/ci.yml', 'utf8')
  const smokeJob = ci.slice(ci.indexOf('  visual-qa-smoke:'))
  assert.match(smokeJob, /github.event_name == 'pull_request' && github.event.action == 'labeled'/)
  assert.match(smokeJob, /uses: \.\/\.github\/workflows\/visual-qa.yml/)
  assert.match(smokeJob, /pr_number: '176'/)
  assert.match(smokeJob, /github.event.label.name == 'qa:visual'/)
  assert.match(smokeJob, /github.event.pull_request.head.repo.full_name == github.repository/)
  assert.match(smokeJob, /github.event.pull_request.draft == false/)
  assert.match(smokeJob, /tooling_sha: \$\{\{ github.event.pull_request.base.sha \}\}/)
  assert.match(smokeJob, /name: ["']Visual QA smoke \(PR #176\)["']/)
  assert.ok(!/secrets:|: write|pages.yml|browser-e2e.yml/.test(smokeJob))
  const qa = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  assert.match(qa, /inputs.tooling_sha == github.event.pull_request.base.sha/)
  assert.match(qa, /workflow_call:/)
  assert.match(qa, /workflow_dispatch:/)
  assert.match(qa, /ref: \$\{\{ inputs.tooling_sha \|\| github.sha \}\}/)
  const delivery = await fs.readFile('.github/workflows/channel-delivery.yml', 'utf8')
  assert.ok(delivery.indexOf('await visualQaOnlyRun') < delivery.indexOf('await selectCandidate'))
  assert.match(delivery, /Visual QA-only smoke run; no candidate build or publication requested/)
})

test('label capture rejects PR tooling SHA, fork and draft; approved staging SHA is the only PR checkout', async () => {
  const workflow = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  const expression = workflow.match(/^ {4}if: (.+)$/m)[1]
  const run = new Function('github', 'inputs', 'return (' + expression + ')')
  const github = {
    ref: 'refs/pull/176/merge',
    event_name: 'pull_request',
    repository: 'owner/repo',
    event: {
      action: 'labeled',
      label: { name: 'qa:visual' },
      pull_request: {
        number: 176,
        state: 'open',
        draft: false,
        base: { ref: 'staging', sha: 'approved-base' },
        head: { repo: { full_name: 'owner/repo' } },
      },
    },
  }
  assert.equal(run(github, { tooling_sha: 'approved-base' }), true)
  assert.equal(run(github, { tooling_sha: 'unreviewed-head' }), false)
  github.event.pull_request.draft = true
  assert.equal(run(github, { tooling_sha: 'approved-base' }), false)
  github.event.pull_request.draft = false
  github.event.pull_request.head.repo.full_name = 'fork/repo'
  assert.equal(run(github, { tooling_sha: 'approved-base' }), false)
  assert.equal(run({ ref: 'refs/heads/staging' }, { tooling_sha: '' }), true)
  assert.equal(run({ ref: 'refs/heads/staging' }, { tooling_sha: 'unreviewed-head' }), false)
})

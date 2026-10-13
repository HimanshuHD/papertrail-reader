import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('Visual QA is queued behind Candidate validation for any labelled eligible PR, with exact run/base identity', async () => {
  const ci = await fs.readFile('.github/workflows/ci.yml', 'utf8')
  const job = ci.slice(ci.indexOf('  visual-qa:'))
  assert.match(job, /needs: gate/)
  assert.match(job, /needs.gate.result == 'success'/)
  assert.match(job, /contains\(github.event.pull_request.labels.\*.name, 'qa:visual'\)/)
  assert.match(job, /candidate_run: \$\{\{ needs.gate.outputs.candidate_run \}\}/)
  assert.match(job, /pr_number: \$\{\{ format\('\{0\}', github.event.pull_request.number\) \}\}/)
  assert.match(job, /profile: auto/)
  assert.ok(!/smoke|number == 176|workflow_dispatch|: write|secrets:/.test(job))
  assert.match(ci, /candidate_run: \$\{\{ steps.previous.outputs.run_id \|\| github.run_id \}\}/)
  const channel = await fs.readFile('.github/workflows/channel-delivery.yml', 'utf8')
  assert.ok(!/visualQaOnlyRun|visual-qa-smoke/.test(channel))
})
test('PR capture accepts only labelled ready same-repository requests with exact gate run and approved base checkout', async () => {
  const workflow = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  const expression = workflow
    .match(/^ {4}if: (.+)$/m)[1]
    .replaceAll(
      'github.event.pull_request.labels.*.name',
      'github.event.pull_request.labels.map(label=>label.name)',
    )
  const run = new Function('github', 'inputs', 'contains', 'format', 'return (' + expression + ')')
  const contains = (values, value) => values.includes(value),
    format = (template, value) => template.replace('{0}', String(value))
  const github = {
    ref: 'refs/pull/300/merge',
    event_name: 'pull_request',
    repository: 'owner/repo',
    event: {
      pull_request: {
        number: 300,
        state: 'open',
        draft: false,
        labels: [{ name: 'qa:visual' }],
        base: { sha: 'approved-base', ref: 'staging' },
        head: { repo: { full_name: 'owner/repo' } },
      },
    },
  }
  const inputs = { tooling_sha: 'approved-base', pr_number: '300', candidate_run: '42' }
  const accept = (g = github, i = inputs) => run(g, i, contains, format)
  assert.equal(accept(), true)
  for (const change of [{ tooling_sha: 'PR-head' }, { pr_number: '301' }, { candidate_run: '' }])
    assert.equal(accept(github, { ...inputs, ...change }), false)
  github.event.pull_request.labels = []
  assert.equal(accept(), false)
  github.event.pull_request.labels = [{ name: 'qa:visual' }]
  github.event.pull_request.draft = true
  assert.equal(accept(), false)
  github.event.pull_request.draft = false
  github.event.pull_request.head.repo.full_name = 'fork/repo'
  assert.equal(accept(), false)
  assert.equal(accept({ ref: 'refs/heads/main' }, { tooling_sha: '', candidate_run: '' }), true)
  assert.equal(accept({ ref: 'refs/heads/staging' }, { tooling_sha: '', candidate_run: '' }), true)
  assert.equal(
    accept({ ref: 'refs/heads/main' }, { tooling_sha: 'unreviewed', candidate_run: '42' }),
    false,
  )
})

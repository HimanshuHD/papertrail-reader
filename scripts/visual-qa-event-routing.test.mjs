import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

test('Visual QA ignores metadata labels and manual dispatch even when the PR already has qa:visual', () => {
  const ci = fs.readFileSync(
    fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)),
    'utf8',
  )
  const job = ci.split('\n  visual-qa:\n')[1]
  const expression = job
    .match(/^ {4}if: (.+)$/m)[1]
    .replaceAll(
      'github.event.pull_request.labels.*.name',
      'github.event.pull_request.labels.map(label=>label.name)',
    )
  const run = new Function('github', 'needs', 'always', 'contains', 'return (' + expression + ')')
  const evaluate = ({
    action = 'synchronize',
    event = 'pull_request',
    label = 'qa:visual',
    changes = {},
    result = 'success',
    draft = false,
    state = 'open',
    sameRepo = true,
    labels = ['qa:visual'],
  } = {}) =>
    run(
      {
        event_name: event,
        repository: 'owner/repo',
        event: {
          action,
          label: { name: label },
          changes,
          pull_request: {
            state,
            draft,
            labels: labels.map((name) => ({ name })),
            head: { repo: { full_name: sameRepo ? 'owner/repo' : 'fork/repo' } },
          },
        },
      },
      { gate: { result } },
      () => true,
      (values, value) => values.includes(value),
    )
  assert.equal(evaluate(), true)
  assert.equal(evaluate({ action: 'labeled' }), true)
  for (const label of ['type:bug', 'status:in-progress', 'severity:medium']) {
    assert.equal(evaluate({ action: 'labeled', label }), false)
  }
  assert.equal(evaluate({ action: 'edited' }), false)
  assert.equal(
    evaluate({ action: 'edited', changes: { base: { ref: { from: 'staging' } } } }),
    true,
  )
  assert.equal(evaluate({ event: 'workflow_dispatch' }), false)
  for (const result of ['failure', 'cancelled', 'skipped'])
    assert.equal(evaluate({ result }), false)
  assert.equal(evaluate({ draft: true }), false)
  assert.equal(evaluate({ state: 'closed' }), false)
  assert.equal(evaluate({ sameRepo: false }), false)
  assert.equal(evaluate({ labels: [] }), false)
})

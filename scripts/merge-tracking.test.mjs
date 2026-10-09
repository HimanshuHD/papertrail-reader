import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

test('merge reconciliation updates issue evidence and parent checklists without repository writes', async () => {
  const workflow = fs.readFileSync('.github/workflows/merge-tracking.yml', 'utf8')
  assert.match(workflow, /contents: read/)
  assert.match(workflow, /issues: write/)
  const script = workflow
    .split('          script: |\n')[1]
    .split('\n')
    .map((line) => line.replace(/^ {12}/, ''))
    .join('\n')
  const issues = [
    {
      number: 11,
      state: 'closed',
      state_reason: 'completed',
      body: 'Status: In review\n- [ ] PR merged to main.',
    },
    { number: 12, state: 'open', body: '- [ ] #11\n- [x] #13' },
    {
      number: 13,
      state: 'closed',
      state_reason: 'not_planned',
      body: 'Deferred',
    },
  ]
  const updates = []
  const github = {
    paginate: async () => issues,
    rest: {
      issues: {
        listForRepo: () => {},
        update: async (update) => updates.push(update),
      },
      repos: new Proxy(
        {},
        {
          get: () => {
            throw new Error('Repository tracking writes are forbidden')
          },
        },
      ),
    },
  }
  const context = {
    repo: { owner: 'fixture', repo: 'reader' },
    payload: {
      pull_request: {
        merged: true,
        number: 20,
        base: { ref: 'main' },
        body: 'Closes #11',
        merge_commit_sha: 'fixture',
        merged_at: '2026-10-09T00:00:00Z',
      },
    },
  }
  const run = () => vm.runInNewContext(`(async () => {\n${script}\n})()`, { github, context })
  await run()
  const completed = updates.find((update) => update.issue_number === 11)
  assert.match(completed.body, /Status: Completed/)
  assert.match(completed.body, /\[x\] PR merged to main/)
  assert.match(completed.body, /Completed by merged PR #20/)
  assert.equal(updates.find((update) => update.issue_number === 12).body, '- [x] #11\n- [ ] #13')
  assert.ok(!updates.some((update) => update.issue_number === 13))
  updates.length = 0
  context.payload.pull_request.merged = false
  await run()
  assert.equal(updates.length, 0)
})

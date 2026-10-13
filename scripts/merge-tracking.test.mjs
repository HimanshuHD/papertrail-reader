import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileMergedIssues, referencedIssues } from './merge-tracking.mjs'

const pr = {
  number: 170,
  merged: true,
  base: { ref: 'staging' },
  head: { repo: { full_name: 'owner/repo' } },
  merge_commit_sha: 'abc',
  body: 'Refs #130.\nFixes #131',
}
function fixture(issues) {
  const updates = []
  const github = {
    rest: {
      issues: {
        listForRepo() {},
        async update(update) {
          updates.push(update)
          Object.assign(
            issues.find((i) => i.number === update.issue_number),
            update,
          )
        },
      },
    },
    async paginate() {
      return issues
    },
  }
  return { github, updates, owner: 'owner', repo: 'repo' }
}
test('only explicit references and closing directives are selected', () => {
  assert.deepEqual(
    [...referencedIssues('Refs #130, #44\nFixes #131\nScreenshot #999')],
    [131, 130, 44],
  )
})
test('staging records implementation without closing issues or completing main acceptance', async () => {
  const issue = {
    number: 130,
    state: 'open',
    body: 'Status: In progress\n- [ ] PR merged to staging.\n- [ ] PR merged to main.\n- [ ] Live acceptance.',
  }
  const f = fixture([issue])
  await reconcileMergedIssues({ ...f, pr })
  assert.match(issue.body, /Staging integration evidence/)
  assert.match(issue.body, /\[x\] PR merged to staging/)
  assert.match(issue.body, /\[ \] PR merged to main/)
  assert.match(issue.body, /\[ \] Live acceptance/)
  assert.equal(issue.state, 'open')
  assert.deepEqual(Object.keys(f.updates[0]).sort(), ['body', 'issue_number', 'owner', 'repo'])
})
test('retries are idempotent', async () => {
  const f = fixture([{ number: 130, state: 'open', body: '' }])
  await reconcileMergedIssues({ ...f, pr })
  assert.equal((await reconcileMergedIssues({ ...f, pr })).updated, 0)
})
test('main completes only already-completed referenced issues and keeps open acceptance', async () => {
  const completed = {
    number: 131,
    state: 'closed',
    state_reason: 'completed',
    body: 'Status: In progress\n- [ ] PR merged to main.',
  }
  const open = { number: 130, state: 'open', body: 'Status: In progress\n- [ ] Live acceptance.' }
  const f = fixture([completed, open])
  await reconcileMergedIssues({ ...f, pr: { ...pr, base: { ref: 'main' } } })
  assert.match(completed.body, /Status: Completed/)
  assert.match(open.body, /Status: In progress/)
  assert.equal(open.state, 'open')
})
test('parent checks follow actual completion and legacy roadmap text stays untouched', async () => {
  const parent = {
    number: 1,
    state: 'open',
    body: '## Current work\nWiki owns planning.\n- [ ] #131\n- [x] #132\n- [ ] #999',
  }
  const f = fixture([
    parent,
    { number: 131, state: 'closed', state_reason: 'completed', body: '' },
    { number: 132, state: 'closed', state_reason: 'not_planned', body: '' },
  ])
  await reconcileMergedIssues({ ...f, pr })
  assert.match(parent.body, /Wiki owns planning/)
  assert.match(parent.body, /\[x\] #131/)
  assert.match(parent.body, /\[ \] #132/)
  assert.match(parent.body, /\[ \] #999/)
  assert.doesNotMatch(parent.body, /Latest merge/)
})
test('closed unmerged PRs, forks and unsupported targets perform no writes', async () => {
  const f = fixture([{ number: 130, state: 'open', body: '' }])
  for (const invalid of [
    { ...pr, merged: false },
    { ...pr, head: { repo: { full_name: 'fork/repo' } } },
    { ...pr, base: { ref: 'other' } },
  ])
    assert.equal((await reconcileMergedIssues({ ...f, pr: invalid })).updated, 0)
  assert.equal(f.updates.length, 0)
})

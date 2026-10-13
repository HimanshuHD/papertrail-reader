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
test('smoke routes the existing registered staging dispatch through the exact shared read-only capture job', async () => {
  const ci = await fs.readFile('.github/workflows/ci.yml', 'utf8')
  const smokeJob = ci.slice(ci.indexOf('  visual-qa-smoke:'))
  assert.match(
    smokeJob,
    /github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/staging'/,
  )
  assert.match(smokeJob, /uses: \.\/\.github\/workflows\/visual-qa.yml/)
  assert.match(smokeJob, /pr_number: '176'/)
  assert.ok(!/secrets:|: write|pages.yml|browser-e2e.yml/.test(smokeJob))
  const qa = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  assert.match(qa, /workflow_call:/)
  assert.match(qa, /workflow_dispatch:/)
  assert.match(qa, /ref: \$\{\{ github.sha \}\}/)
  const delivery = await fs.readFile('.github/workflows/channel-delivery.yml', 'utf8')
  assert.ok(delivery.indexOf('await visualQaOnlyRun') < delivery.indexOf('await selectCandidate'))
  assert.match(delivery, /Visual QA-only smoke run; no candidate build or publication requested/)
})

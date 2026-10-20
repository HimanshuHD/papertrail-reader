import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('visual scripts are reachable only from the independently dispatched workflow', async () => {
  const workflows = await fs.readdir('.github/workflows')
  for (const file of workflows.filter((file) => file.endsWith('.yml'))) {
    const source = await fs.readFile('.github/workflows/' + file, 'utf8')
    if (file === 'visual-qa.yml') {
      const events = source.split('\non:\n')[1].split('\npermissions:')[0]
      assert.deepEqual(
        [...events.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]),
        ['workflow_dispatch'],
      )
      assert.doesNotMatch(source, /workflow_call|qa:visual|: write|secrets:/)
      assert.match(source, /baseline-review-evidence\//)
      assert.match(source, /repeat_stability:/)
      assert.match(source, /options: \[preview, staging, production\]/)
    } else {
      assert.doesNotMatch(
        source,
        /visual-qa\.yml|run-visual-qa|visual-qa-report|review-approved-baselines|tests\/visual|test:visual|playwright\.visual|baseline-review-evidence/,
        file,
      )
    }
  }
  await assert.rejects(fs.access('.github/workflows/baseline-review.yml'))
})
test('only explicit dispatch on trusted workflow branches can run capture', async () => {
  const workflow = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  const expression = workflow.match(/^ {4}if: (.+)$/m)[1]
  const evaluate = new Function('github', 'return (' + expression + ')')
  for (const ref of ['refs/heads/main', 'refs/heads/staging']) {
    assert.equal(evaluate({ event_name: 'workflow_dispatch', ref }), true)
    for (const event_name of [
      'pull_request',
      'pull_request_target',
      'push',
      'schedule',
      'workflow_run',
      'workflow_call',
    ])
      assert.equal(evaluate({ event_name, ref }), false)
  }
  assert.equal(
    evaluate({ event_name: 'workflow_dispatch', ref: 'refs/heads/feature/unreviewed' }),
    false,
  )
  assert.match(workflow, /ref: \$\{\{ github.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
})
test('manual repeat review consumes the verified artifact and preserves failure evidence without rebuilding', async () => {
  const script = await fs.readFile('scripts/review-approved-baselines.mjs', 'utf8')
  assert.match(script, /REVIEW_BUILD_FOLDER/)
  assert.match(script, /verifyCandidate\(folder, build\)/)
  assert.doesNotMatch(script, /build-candidates|execFileSync/)
  const workflow = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  assert.match(workflow, /if: \$\{\{ !inputs.repeat_stability \}\}/)
  assert.match(workflow, /if: \$\{\{ inputs.repeat_stability \}\}/)
  assert.match(workflow, /name: Preserve all comparison evidence\n {8}if: always\(\)/)
  assert.match(workflow, /name: Report separate acceptance statuses\n {8}if: always\(\)/)
})

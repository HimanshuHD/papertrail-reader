import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) =>
  fs.readFileSync(fileURLToPath(new URL('../' + path, import.meta.url)), 'utf8')
const evaluate = (expression, values) =>
  new Function(
    'inputs',
    'needs',
    'github',
    'always',
    'cancelled',
    'return (' + expression.replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '') + ')',
  )(
    values.inputs,
    values.needs,
    values.github,
    () => true,
    () => values.cancelled,
  )

test('cancelled integration cannot start publication after successful selection or a skipped main browser', () => {
  const workflow = read('.github/workflows/channel-delivery.yml')
  const expression = workflow.split('\n  publish:\n')[1].match(/^ {4}if: (.+)$/m)[1]
  const run = ({
    branch = 'main',
    browser = 'skipped',
    select = 'success',
    skip = 'false',
    cancelled = false,
  } = {}) =>
    evaluate(expression, {
      inputs: { branch },
      needs: { select: { result: select, outputs: { skip } }, browser: { result: browser } },
      github: {},
      cancelled,
    })
  assert.equal(run(), true)
  assert.equal(run({ branch: 'staging', browser: 'success' }), true)
  assert.equal(run({ cancelled: true }), false)
  assert.equal(run({ branch: 'staging', browser: 'success', cancelled: true }), false)
  for (const select of ['failure', 'cancelled', 'skipped']) assert.equal(run({ select }), false)
  assert.equal(run({ skip: 'true' }), false)
  for (const browser of ['failure', 'cancelled', 'skipped'])
    assert.equal(run({ branch: 'staging', browser }), false)
})

test('shared publisher also rejects cancellation while retaining trusted retirement and recovery operations', () => {
  const expression = read('.github/workflows/pages.yml')
    .split('\n  publish:\n')[1]
    .match(/^ {4}if: (.+)$/m)[1]
  const run = (event, sameRepo, cancelled) =>
    evaluate(expression, {
      inputs: {},
      needs: {},
      cancelled,
      github: {
        event_name: event,
        repository: 'owner/repo',
        event: {
          pull_request: { head: { repo: { full_name: sameRepo ? 'owner/repo' : 'fork/repo' } } },
        },
      },
    })
  for (const event of [
    'workflow_call',
    'workflow_run',
    'workflow_dispatch',
    'schedule',
    'pull_request_target',
  ]) {
    assert.equal(run(event, true, false), true)
    assert.equal(run(event, true, true), false)
  }
  assert.equal(run('pull_request_target', false, false), false)
})

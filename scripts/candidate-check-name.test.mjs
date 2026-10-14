import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workflow = fs.readFileSync(
  fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)),
  'utf8',
)
const gate = workflow.split('\n  gate:\n')[1].split('\n  visual-qa:')[0]
const nameExpression = gate.match(/^ {4}name: (.+)$/m)[1]
const condition = gate.match(/^ {4}if: (.+)$/m)[1]
const evaluate = (expression, github) =>
  new Function(
    'github',
    'always',
    'return (' + expression.replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '') + ')',
  )(github, () => true)
const event = (action, overrides = {}) => ({
  event_name: 'pull_request',
  event: {
    action,
    label: { name: 'type:bug' },
    changes: {},
    pull_request: { state: 'open', draft: false },
    ...overrides,
  },
})

test('ignored metadata checks cannot satisfy or replace the pending required candidate check', () => {
  const checks = [{ name: 'Candidate validation', conclusion: null }]
  for (const github of [
    event('labeled'),
    event('labeled', { label: { name: 'status:in-progress' } }),
    event('edited'),
    event('converted_to_draft', { pull_request: { state: 'open', draft: true } }),
    event('closed', { pull_request: { state: 'closed', draft: false } }),
  ]) {
    assert.equal(evaluate(condition, github), false)
    const name = evaluate(nameExpression, github)
    assert.notEqual(name, 'Candidate validation')
    checks.push({ name, conclusion: 'skipped' })
  }
  const required = checks.filter((check) => check.name === 'Candidate validation')
  assert.deepEqual(required, [{ name: 'Candidate validation', conclusion: null }])
  for (const github of [
    ...['opened', 'ready_for_review', 'synchronize', 'reopened'].map((action) => event(action)),
    event('edited', { changes: { base: { ref: { from: 'staging' } } } }),
    event('labeled', { label: { name: 'qa:visual' } }),
    { event_name: 'workflow_dispatch', event: {} },
  ]) {
    assert.equal(evaluate(condition, github), true)
    assert.equal(evaluate(nameExpression, github), 'Candidate validation')
  }
})

test('the required gate runs after dependency failure and rejects missing or failed validation', () => {
  assert.match(condition, /^always\(\) && /)
  const script = gate.split('        run: |\n')[1].trim()
  const run = (frontend, browser, target = 'main', website = 'true') =>
    execFileSync('bash', ['-e', '-c', script], {
      env: {
        ...process.env,
        FRONTEND: frontend,
        BROWSER: browser,
        TARGET: target,
        WEBSITE: website,
      },
      stdio: 'pipe',
    })
  for (const frontend of ['failure', 'cancelled', 'skipped', '']) {
    assert.throws(() => run(frontend, 'success'))
  }
  for (const browser of ['failure', 'cancelled', 'skipped', '']) {
    assert.throws(() => run('success', browser))
  }
  assert.doesNotThrow(() => run('success', 'success'))
  assert.doesNotThrow(() => run('success', 'skipped', 'staging'))
  assert.doesNotThrow(() => run('success', 'skipped', 'main', 'false'))
})

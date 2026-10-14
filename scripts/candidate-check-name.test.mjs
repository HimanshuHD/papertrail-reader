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
test('metadata checks keep a static required name and verify another current candidate', () => {
  assert.match(gate, /^ {4}name: Candidate validation$/m)
  assert.match(gate, /^ {4}if: always\(\)$/m)
  assert.match(gate, /waitForCandidate/)
  assert.match(gate, /candidateAcceptance:true,excludeRun:context.runId/)
  assert.match(gate, /expectedHead:pr.head.sha,expectedBase:pr.base.sha/)
  assert.match(gate, /pr.state!=='open' \|\| pr.draft/)
  assert.match(gate, /persist-credentials: false/)
})

test('the required gate runs after dependency failure and rejects missing or failed validation', () => {
  assert.match(gate, /^ {4}if: always\(\)$/m)
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

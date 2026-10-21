import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  acceptanceOptions,
  summarizeTrials,
  bundleEvidence,
  verifyTrialCoverage,
} from './diagnostics-acceptance-report.mjs'
test('manual acceptance rejects unknown/duplicate engines and invalid repeat counts', () => {
  assert.deepEqual(acceptanceOptions({}), { engines: ['chromium'], trials: 3 })
  assert.deepEqual(
    acceptanceOptions({ DIAGNOSTIC_ENGINES: 'firefox,webkit', DIAGNOSTIC_TRIALS: '5' }),
    { engines: ['firefox', 'webkit'], trials: 5 },
  )
  for (const env of [
    { DIAGNOSTIC_ENGINES: 'chromium,chromium' },
    { DIAGNOSTIC_ENGINES: 'edge' },
    { DIAGNOSTIC_TRIALS: '2' },
    { DIAGNOSTIC_TRIALS: '3.5' },
    { DIAGNOSTIC_TRIALS: '21' },
  ])
    assert.throws(() => acceptanceOptions(env))
})
test('workload summaries keep engines/modes separate and withhold sparse p95', () => {
  const input = [1, 100, 3, 2].map((elapsedMs) => ({
    engine: 'chromium',
    mode: 'closed',
    elapsedMs,
  }))
  input.push(
    { engine: 'webkit', mode: 'closed', elapsedMs: 99 },
    { engine: 'chromium', mode: 'sampling', elapsedMs: 7 },
  )
  const result = summarizeTrials(input)
  assert.deepEqual(result[0], {
    group: 'chromium:closed',
    count: 4,
    medianMs: 2.5,
    worstMs: 100,
    p95Ms: null,
  })
  assert.equal(result.length, 3)
  assert.equal(
    summarizeTrials(
      Array.from({ length: 20 }, (_, i) => ({
        engine: 'chromium',
        mode: 'closed',
        elapsedMs: i + 1,
      })),
    )[0].p95Ms,
    19,
  )
  assert.throws(() => summarizeTrials([{ engine: 'chromium', mode: 'closed', elapsedMs: NaN }]))
  assert.throws(() => summarizeTrials([{ engine: 'chromium', mode: 'unknown', elapsedMs: 1 }]))
})
test('bundle evidence hashes every artifact and checks diagnostics across split scripts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'diagnostic-report-test-'))
  try {
    await mkdir(path.join(root, 'assets'))
    await writeFile(path.join(root, 'index.html'), 'example')
    await writeFile(
      path.join(root, 'assets', 'a.js'),
      'Developer diagnostics;resourceInvestigation',
    )
    await writeFile(
      path.join(root, 'assets', 'b.js'),
      'What remains after closing?;Capture sensors',
    )
    const first = await bundleEvidence(root)
    assert.equal(first.files.length, 3)
    assert.ok(first.bytes > 0)
    assert.ok(Object.values(first.diagnosticMarkers).every(Boolean))
    await writeFile(path.join(root, 'assets', 'b.js'), 'plain production')
    const second = await bundleEvidence(root)
    assert.notEqual(
      first.files.find((f) => f.path === 'assets/b.js').sha256,
      second.files.find((f) => f.path === 'assets/b.js').sha256,
    )
    assert.equal(second.diagnosticMarkers['Capture sensors'], false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('coverage rejects duplicated, missing and foreign trial identities', () => {
  const rows = ['production', 'closed', 'sampling', 'paused'].flatMap((mode) =>
    [1, 2, 3].map((trial) => ({ engine: 'chromium', mode, trial })),
  )
  assert.doesNotThrow(() => verifyTrialCoverage(rows, ['chromium'], 3))
  assert.throws(() => verifyTrialCoverage(rows.slice(1), ['chromium'], 3))
  assert.throws(() => verifyTrialCoverage([...rows, rows[0]], ['chromium'], 3))
  assert.throws(() =>
    verifyTrialCoverage([{ ...rows[0], engine: 'webkit' }, ...rows.slice(1)], ['chromium'], 3),
  )
})

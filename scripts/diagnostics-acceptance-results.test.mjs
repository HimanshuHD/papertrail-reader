import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptanceResults } from './diagnostics-acceptance-results.mjs'
const attachment = (name, value) => ({
  name,
  body: Buffer.from(JSON.stringify(value)).toString('base64'),
})
const rows = (engine) =>
  ['production', 'closed', 'sampling', 'paused'].flatMap((mode) =>
    [1, 2, 3].map((trial) => ({ engine, mode, trial, elapsedMs: 100 + trial })),
  )
const spec = (engine, status, attachments = []) => ({
  title: 'controlled workload',
  tests: [{ projectName: engine, results: [{ status, retry: 0, attachments }] }],
})
test('failed browser retains completed engines and partial trials with failure stage evidence', async () => {
  const failed = {
    engine: 'webkit',
    trial: 1,
    mode: 'closed',
    stage: 'epubOpen',
    completedStages: { pdfOpen: 100 },
    pageErrors: ['TypeError'],
    ui: { selectedFormat: 'pdf', epubTabs: 0 },
  }
  const p = {
    stats: { unexpected: 1 },
    suites: [
      {
        specs: [
          spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('chromium'))]),
          spec('firefox', 'passed', [attachment('diagnostic-workload-trials', rows('firefox'))]),
          spec('webkit', 'failed', [
            attachment('diagnostic-workload-trials', rows('webkit').slice(0, 1)),
            attachment('diagnostic-workload-failure', failed),
          ]),
        ],
      },
    ],
  }
  const result = await acceptanceResults(p, ['chromium', 'firefox', 'webkit'], 3)
  assert.equal(result.trials.length, 25)
  assert.equal(result.summary.length, 9)
  assert.equal(result.accepted, false)
  assert.equal(result.coverage.complete, false)
  assert.deepEqual(result.workloadFailures, [failed])
  assert.equal(result.caseOutcomes.at(-1).status, 'failed')
})
test('full workload coverage cannot mask a separate failed functional case or flaky retry', async () => {
  for (const result of [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ]) {
    const p = {
      specs: [
        spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('chromium'))]),
        { title: 'functional check', tests: [{ projectName: 'chromium', results: [result] }] },
      ],
    }
    const evidence = await acceptanceResults(p, ['chromium'], 3)
    assert.equal(evidence.coverage.complete, true)
    assert.equal(evidence.accepted, false)
  }
})
test('successful report passes only with complete requested engine coverage and valid attachments', async () => {
  const p = {
    specs: [
      spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('chromium'))]),
      spec('chromium', 'skipped'),
    ],
  }
  assert.equal((await acceptanceResults(p, ['chromium'], 3)).accepted, true)
  assert.equal((await acceptanceResults(p, ['chromium', 'webkit'], 3)).accepted, false)
  const forged = {
    specs: [
      spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('firefox'))]),
    ],
  }
  await assert.rejects(acceptanceResults(forged, ['chromium'], 3), /Invalid workload attachment/)
})
test('old failed reports without partial attachments still preserve other browser results', async () => {
  const p = {
    stats: { unexpected: 1 },
    specs: [
      spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('chromium'))]),
      spec('webkit', 'failed'),
    ],
  }
  const evidence = await acceptanceResults(p, ['chromium', 'webkit'], 3)
  assert.equal(evidence.trials.length, 12)
  assert.equal(evidence.summary.length, 4)
  assert.equal(evidence.accepted, false)
})

test('representative coverage is independently required and projects only reviewed fields', async () => {
  const cases = [
    ['library-100', 100, 2, 0],
    ['library-1000', 1000, 2, 0],
    ['pdf-1001', 1, 1001, 0],
    ['epub-long', 1, 0, 1000],
  ].map(([scenario, files, pdfPages, paragraphs]) => ({
    engine: 'chromium',
    scenario,
    files,
    pdfPages,
    paragraphs,
    fixtureBytes: 1000,
    elapsedMs: 100,
    privateFilename: 'never-copy.pdf',
  }))
  const report = (values) => ({
    specs: [
      spec('chromium', 'passed', [attachment('diagnostic-workload-trials', rows('chromium'))]),
      ...values.map((value) =>
        spec('chromium', 'passed', [attachment('representative-functional-evidence', value)]),
      ),
    ],
  })
  const complete = await acceptanceResults(report(cases), ['chromium'], 3, true)
  assert.equal(complete.accepted, true)
  assert.equal(complete.representative.length, 4)
  assert.equal(JSON.stringify(complete).includes('never-copy'), false)
  for (const values of [[], cases.slice(0, 3), [...cases.slice(0, 3), cases[0]]]) {
    const result = await acceptanceResults(report(values), ['chromium'], 3, true)
    assert.equal(result.coverage.complete, true)
    assert.equal(result.accepted, false)
  }
  for (const patch of [
    { engine: 'firefox' },
    { scenario: 'unknown' },
    { files: 200 },
    { elapsedMs: -1 },
    { fixtureBytes: 0 },
  ])
    await assert.rejects(
      acceptanceResults(report([{ ...cases[0], ...patch }]), ['chromium'], 3, true),
      /Invalid representative attachment/,
    )
})

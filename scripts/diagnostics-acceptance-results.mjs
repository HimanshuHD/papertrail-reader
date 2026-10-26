import { readFile } from 'node:fs/promises'
import {
  summarizeTrials,
  verifyTrialCoverage,
  legacyWorkloadModes,
} from './diagnostics-acceptance-report.mjs'

/** Preserve every completed workload even when a different functional case/browser failed. */
export async function acceptanceResults(
  results,
  engines,
  count,
  requireRepresentative = false,
  modes = legacyWorkloadModes,
  requireLibraryAccess = false,
) {
  const trials = [],
    workloadFailures = [],
    caseOutcomes = [],
    representative = [],
    libraryAccess = []
  async function walk(suite) {
    for (const spec of suite.specs || [])
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          caseOutcomes.push({
            engine: test.projectName,
            test: spec.title,
            status: result.status,
            retry: result.retry ?? 0,
          })
          for (const attachment of result.attachments || []) {
            if (
              ![
                'diagnostic-workload-trials',
                'diagnostic-workload-failure',
                'representative-functional-evidence',
                'library-access-functional-evidence',
              ].includes(attachment.name)
            )
              continue
            const value = JSON.parse(
              attachment.body
                ? Buffer.from(attachment.body, 'base64').toString('utf8')
                : await readFile(attachment.path, 'utf8'),
            )
            if (attachment.name === 'library-access-functional-evidence') {
              if (
                value.engine !== test.projectName ||
                !engines.includes(value.engine) ||
                !['picker-cancel', 'picker-denied', 'picker-unavailable'].includes(
                  value.scenario,
                ) ||
                value.mechanism !== 'controlled-picker-rejection' ||
                value.preserved !== true ||
                !Array.isArray(value.resourceDelta) ||
                value.resourceDelta.length !== 3 ||
                value.resourceDelta.some((delta) => delta !== 0) ||
                value.recovery !==
                  (value.scenario === 'picker-unavailable'
                    ? 'directory-input'
                    : 'continued-reading')
              )
                throw new Error('Invalid library access attachment')
              libraryAccess.push({
                engine: value.engine,
                scenario: value.scenario,
                mechanism: value.mechanism,
                preserved: true,
                resourceDelta: [0, 0, 0],
                recovery: value.recovery,
              })
            } else if (attachment.name === 'representative-functional-evidence') {
              const expected = {
                'library-100': [100, 2, 0],
                'library-1000': [1000, 2, 0],
                'pdf-1001': [1, 1001, 0],
                'pdf-images': [1, 12, 0],
                'epub-long': [1, 0, 1000],
              }[value.scenario]
              if (
                !expected ||
                value.engine !== test.projectName ||
                !engines.includes(value.engine) ||
                [value.files, value.pdfPages, value.paragraphs].some((v, i) => v !== expected[i]) ||
                !Number.isSafeInteger(value.fixtureBytes) ||
                value.fixtureBytes <= 0 ||
                !Number.isFinite(value.elapsedMs) ||
                value.elapsedMs < 0 ||
                (value.listingMs !== undefined &&
                  (!Number.isFinite(value.listingMs) || value.listingMs < 0))
              )
                throw new Error('Invalid representative attachment')
              // Project only the reviewed fixed/numeric schema; never retain arbitrary attachment fields.
              representative.push({
                engine: value.engine,
                scenario: value.scenario,
                files: value.files,
                pdfPages: value.pdfPages,
                paragraphs: value.paragraphs,
                fixtureBytes: value.fixtureBytes,
                elapsedMs: value.elapsedMs,
                ...(value.listingMs === undefined ? {} : { listingMs: value.listingMs }),
              })
            } else if (attachment.name === 'diagnostic-workload-trials') {
              if (!Array.isArray(value) || value.some((row) => row.engine !== test.projectName))
                throw new Error('Invalid workload attachment')
              trials.push(...value)
            } else {
              if (value.engine !== test.projectName) throw new Error('Invalid failure attachment')
              workloadFailures.push(value)
            }
          }
        }
      }
    for (const child of suite.suites || []) await walk(child)
  }
  await walk(results)
  const coverage = {
    expectedTrials: engines.length * count * modes.length,
    completedTrials: trials.length,
    complete: false,
    reason: null,
  }
  try {
    verifyTrialCoverage(trials, engines, count, modes)
    coverage.complete = true
  } catch (error) {
    coverage.reason = error.message
  }
  const representativeKeys = representative.map((row) => `${row.engine}:${row.scenario}`)
  const representativeCoverage = {
    required: requireRepresentative,
    expectedCases: engines.length * 5,
    completedCases: representative.length,
    complete:
      representative.length === engines.length * 5 &&
      new Set(representativeKeys).size === representative.length,
  }
  const libraryAccessCoverage = {
    required: requireLibraryAccess,
    expectedCases: engines.length * 3,
    completedCases: libraryAccess.length,
    complete:
      libraryAccess.length === engines.length * 3 &&
      new Set(libraryAccess.map((row) => `${row.engine}:${row.scenario}`)).size ===
        libraryAccess.length,
  }
  const failed = Boolean(
    results.errors?.length ||
    results.stats?.unexpected ||
    results.stats?.flaky ||
    workloadFailures.length ||
    caseOutcomes.some((row) => !['passed', 'skipped'].includes(row.status) || row.retry > 0),
  )
  return {
    representative,
    representativeCoverage,
    libraryAccess,
    libraryAccessCoverage,
    trials,
    summary: summarizeTrials(trials),
    readerWorkSummary: summarizeTrials(
      trials
        .filter((row) => row.readerWorkMs !== undefined)
        .map((row) => ({ ...row, elapsedMs: row.readerWorkMs })),
    ),
    stageSummary: summarizeTrials(
      trials.flatMap((row) =>
        Object.entries(row.stages ?? {}).map(([stage, elapsedMs]) => ({
          engine: `${row.engine}/${stage}`,
          mode: row.mode,
          elapsedMs,
        })),
      ),
    ),
    workloadFailures,
    caseOutcomes,
    coverage,
    accepted:
      coverage.complete &&
      !failed &&
      (!requireRepresentative || representativeCoverage.complete) &&
      (!requireLibraryAccess || libraryAccessCoverage.complete),
  }
}

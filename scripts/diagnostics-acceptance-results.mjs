import { readFile } from 'node:fs/promises'
import { summarizeTrials, verifyTrialCoverage } from './diagnostics-acceptance-report.mjs'

/** Preserve every completed workload even when a different functional case/browser failed. */
export async function acceptanceResults(results, engines, count) {
  const trials = [],
    workloadFailures = [],
    caseOutcomes = []
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
              !['diagnostic-workload-trials', 'diagnostic-workload-failure'].includes(
                attachment.name,
              )
            )
              continue
            const value = JSON.parse(
              attachment.body
                ? Buffer.from(attachment.body, 'base64').toString('utf8')
                : await readFile(attachment.path, 'utf8'),
            )
            if (attachment.name === 'diagnostic-workload-trials') {
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
    expectedTrials: engines.length * count * 4,
    completedTrials: trials.length,
    complete: false,
    reason: null,
  }
  try {
    verifyTrialCoverage(trials, engines, count)
    coverage.complete = true
  } catch (error) {
    coverage.reason = error.message
  }
  const failed = Boolean(
    results.errors?.length ||
    results.stats?.unexpected ||
    results.stats?.flaky ||
    workloadFailures.length ||
    caseOutcomes.some((row) => !['passed', 'skipped'].includes(row.status) || row.retry > 0),
  )
  return {
    trials,
    summary: summarizeTrials(trials),
    workloadFailures,
    caseOutcomes,
    coverage,
    accepted: coverage.complete && !failed,
  }
}

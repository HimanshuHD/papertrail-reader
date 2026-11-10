/** Combine sequential phase reports without dropping failed cases or attachments. */
export function combineReaderReports(reports) {
  if (reports.length !== 2) throw new Error('Both lifecycle and functional reports are required')
  const counts = ['expected', 'unexpected', 'flaky', 'skipped']
  for (const report of reports) {
    if (
      !Array.isArray(report.suites) ||
      !Array.isArray(report.errors) ||
      !report.stats ||
      !Number.isFinite(report.stats.duration) ||
      report.stats.duration < 0 ||
      counts.some((key) => !Number.isInteger(report.stats[key]) || report.stats[key] < 0)
    )
      throw new Error('Invalid reader phase report')
  }
  const stats = {
    startTime: reports[0].stats.startTime,
    duration: reports.reduce((sum, report) => sum + report.stats.duration, 0),
  }
  for (const key of counts) stats[key] = reports.reduce((sum, report) => sum + report.stats[key], 0)
  return {
    ...reports[1],
    suites: reports.flatMap((report) => report.suites),
    errors: reports.flatMap((report) => report.errors),
    stats,
    readerPhases: ['lifecycle', 'functional'],
  }
}

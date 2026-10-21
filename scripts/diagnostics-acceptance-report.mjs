import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export function acceptanceOptions(env = process.env) {
  const engines = (env.DIAGNOSTIC_ENGINES || 'chromium').split(',')
  const trials = Number(env.DIAGNOSTIC_TRIALS || 3)
  if (
    !engines.length ||
    new Set(engines).size !== engines.length ||
    engines.some((e) => !['chromium', 'firefox', 'webkit'].includes(e))
  )
    throw new Error('DIAGNOSTIC_ENGINES must be unique chromium,firefox,webkit names')
  if (!Number.isInteger(trials) || trials < 3 || trials > 20)
    throw new Error('DIAGNOSTIC_TRIALS must be an integer from 3 to 20')
  return { engines, trials }
}
export function summarizeTrials(trials) {
  const groups = new Map()
  for (const trial of trials) {
    if (
      !['production', 'closed', 'sampling', 'paused'].includes(trial.mode) ||
      !Number.isFinite(trial.elapsedMs) ||
      trial.elapsedMs < 0
    )
      throw new Error('Invalid workload result')
    const key = `${trial.engine}:${trial.mode}`
    const values = groups.get(key) || []
    values.push(trial.elapsedMs)
    groups.set(key, values)
  }
  return [...groups].map(([group, values]) => {
    values.sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    return {
      group,
      count: values.length,
      medianMs: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
      worstMs: values.at(-1),
      p95Ms: values.length >= 20 ? values[Math.ceil(values.length * 0.95) - 1] : null,
    }
  })
}
export async function bundleEvidence(directory) {
  const files = []
  async function walk(root, prefix = '') {
    for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const relative = path.posix.join(prefix, entry.name)
      if (entry.isDirectory()) await walk(path.join(root, entry.name), relative)
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(root, entry.name))
        files.push({
          path: relative,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })
      }
    }
  }
  await walk(directory)
  const scripts = (
    await Promise.all(
      files
        .filter((f) => f.path.endsWith('.js'))
        .map((f) => readFile(path.join(directory, f.path), 'utf8')),
    )
  ).join('\n')
  const markers = [
    'Developer diagnostics',
    'resourceInvestigation',
    'What remains after closing?',
    'Capture sensors',
  ]
  return {
    files,
    bytes: files.reduce((total, f) => total + f.bytes, 0),
    diagnosticMarkers: Object.fromEntries(markers.map((m) => [m, scripts.includes(m)])),
  }
}

export function verifyTrialCoverage(rows, engines, count) {
  const keys = new Set()
  for (const row of rows) {
    if (
      !engines.includes(row.engine) ||
      !['production', 'closed', 'sampling', 'paused'].includes(row.mode) ||
      !Number.isInteger(row.trial) ||
      row.trial < 1 ||
      row.trial > count
    )
      throw new Error('Unexpected workload trial identity')
    const key = `${row.engine}:${row.mode}:${row.trial}`
    if (keys.has(key)) throw new Error('Duplicate workload trial')
    keys.add(key)
  }
  if (keys.size !== engines.length * count * 4) throw new Error('Missing workload trials')
}

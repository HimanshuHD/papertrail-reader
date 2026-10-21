// Recorder-only microbenchmark. This does not measure reader/render/process-memory overhead.
import { DiagnosticRecorder } from '../src/features/diagnostics/recorder.ts'
import { performance } from 'node:perf_hooks'
const cases = [
  { label: 'scan-like events', metric: 'library.scan', count: 1000 },
  { label: 'PDF render/cache-like events', metric: 'pdf.render', count: 1000 },
  { label: 'EPUB chapter/reflow-like events', metric: 'epub.reflow', count: 1000 },
]
const result = []
for (const workload of cases) {
  const run = (enabled) => {
    const recorder = new DiagnosticRecorder()
    if (enabled) recorder.resume()
    const owner = {}
    const start = performance.now()
    for (let index = 0; index < workload.count; index++) {
      const end = recorder.start(workload.metric)
      recorder.resources(owner, { viewers: 1, previewEntries: index % 128, blobURLs: index % 8 })
      end?.(index % 10 ? 'completed' : 'cancelled')
      if (index % 60 === 0) recorder.snapshot()
    }
    recorder.release(owner)
    return performance.now() - start
  }
  run(true)
  run(false)
  const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const paused = [],
    sampling = []
  for (let trial = 0; trial < 21; trial++) {
    paused.push(run(false))
    sampling.push(run(true))
  }
  result.push({
    workload: workload.label,
    operations: workload.count,
    pausedMedianMs: median(paused),
    samplingMedianMs: median(sampling),
  })
}
console.log(
  JSON.stringify(
    {
      scope: 'synthetic recorder API only; not representative full-reader acceptance',
      node: process.version,
      result,
    },
    null,
    2,
  ),
)

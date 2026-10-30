import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combineReaderReports } from './reader-acceptance-report.mjs'
const report = (expected, unexpected, suite) => ({
  suites: [suite],
  errors: [],
  stats: {
    startTime: '2026-10-30T00:00:00.000Z',
    duration: 100,
    expected,
    unexpected,
    flaky: 0,
    skipped: 0,
  },
})
test('reader phases retain every suite, failure, error and attachment in one report', () => {
  const attachment = { name: 'expiry evidence', path: '/private/generated-evidence.json' }
  const a = report(3, 0, { title: 'lifecycle', attachments: [attachment] })
  const b = report(111, 9, { title: 'functional' })
  b.errors.push({ message: 'browser error' })
  const result = combineReaderReports([a, b])
  assert.equal(result.suites.length, 2)
  assert.equal(result.suites[0].attachments[0], attachment)
  assert.deepEqual(result.errors, b.errors)
  assert.equal(result.stats.expected, 114)
  assert.equal(result.stats.unexpected, 9)
  assert.equal(result.stats.duration, 200)
})
test('reader phases cannot silently accept missing or malformed phase reports', () => {
  assert.throws(() => combineReaderReports([report(3, 0, {})]))
  assert.throws(() => combineReaderReports([report(3, 0, {}), { suites: [] }]))
})

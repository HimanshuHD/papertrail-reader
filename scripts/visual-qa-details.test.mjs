import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evidenceDetails,
  jsonTabs,
  testCaseDetails,
  testReportDetails,
} from './visual-qa-details.mjs'
test('evidence details preserve zero/false, identify missing fields and escape captured content', () => {
  const html = evidenceDetails(
    {
      progress: 0,
      reducedMotion: false,
      spriteFrame: 0,
      route: '<script>bad</script>',
      candidate: { headSha: 'abc' },
    },
    'capture',
  )
  assert.match(html, /0%/)
  assert.match(html, />false</)
  assert.match(html, /Not recorded/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  const tabs = jsonTabs('capture-0', { arbitrary: '<img>' }, html)
  assert.match(tabs, />JSON</)
  assert.match(tabs, />Details</)
  assert.match(tabs, /id="capture-0-details" checked/)
  assert.match(tabs, /arbitrary/)
})
test('test details expose retries, errors and attachments without treating expected status as outcome', () => {
  const html = testCaseDetails(
    { title: 'Retry', file: 'test.ts', line: 7 },
    {
      projectName: 'mobile',
      status: 'unexpected',
      expectedStatus: 'passed',
      results: [
        {
          status: 'failed',
          duration: 0,
          retry: 0,
          errors: [{ message: '<unsafe>' }],
          attachments: [{ name: 'trace', contentType: 'application/zip', path: 'trace.zip' }],
        },
      ],
    },
  )
  assert.match(html, /unexpected/)
  assert.match(html, /failed/)
  assert.match(html, /0 ms/)
  assert.match(html, /&lt;unsafe&gt;/)
  assert.match(html, /trace.zip/)
  assert.match(
    testReportDetails({ stats: { unexpected: 1, expected: 0 } }, 1),
    /Failed \(unexpected\)/,
  )
})

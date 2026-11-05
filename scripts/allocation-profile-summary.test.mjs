import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAllocationProfile } from './allocation-profile-summary.mjs'

const node = (label, selfSize, children = []) => ({ callFrame: { label }, selfSize, children })
test('caller attribution counts repeated ancestors once and keeps exclusive totals separate', () => {
  const profile = {
    head: node(null, 0, [
      node('workspace', 10, [node('vue', 20, [node('workspace', 30)])]),
      node(null, 4),
    ]),
  }
  const result = summarizeAllocationProfile(profile, (frame) => frame.label)
  assert.equal(result.totalBytes, 64)
  assert.deepEqual(result.exclusiveBytes, [
    { group: 'workspace', bytes: 40 },
    { group: 'vue', bytes: 20 },
    { group: '(unmapped)', bytes: 4 },
  ])
  assert.deepEqual(result.contextBytes, [
    { group: 'workspace', bytes: 60 },
    { group: 'vue', bytes: 50 },
  ])
  assert.equal(
    result.exclusiveBytes.reduce((sum, row) => sum + row.bytes, 0),
    result.totalBytes,
  )
})
test('invalid samples fail rather than producing plausible allocation totals', () => {
  for (const size of [-1, NaN, Infinity])
    assert.throws(
      () => summarizeAllocationProfile({ head: node(null, size) }, () => null),
      /selfSize/,
    )
  assert.equal(summarizeAllocationProfile({ head: node(null, 0) }, () => null).totalBytes, 0)
})

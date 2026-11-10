import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileModes, profileOptions } from './browser-profile-options.mjs'

test('profiling defaults retain the complete comparison matrix', () => {
  assert.deepEqual(profileOptions({}), { modes: profileModes, browserArgs: [] })
  profileOptions({}).modes.pop()
  assert.equal(profileOptions({}).modes.length, profileModes.length)
})
test('a focused increment preserves explicitly selected mode order', () => {
  assert.deepEqual(profileOptions({ PROFILE_MODES: 'closed,production' }).modes, [
    'closed',
    'production',
  ])
})
test('unsupported, duplicate or empty modes cannot silently mislabel a report', () => {
  for (const modes of ['', 'production,', 'production,production', 'unknown', 'production, closed'])
    assert.throws(() => profileOptions({ PROFILE_MODES: modes }), /PROFILE_MODES/)
})
test('custom browser flags stay structured and invalid values fail before launch', () => {
  assert.deepEqual(
    profileOptions({ PROFILE_CHROMIUM_ARGS: '["--disable-dev-shm-usage"]' }).browserArgs,
    ['--disable-dev-shm-usage'],
  )
  for (const args of ['null', '{}', '[1]', '["not-a-flag"]'])
    assert.throws(() => profileOptions({ PROFILE_CHROMIUM_ARGS: args }), /PROFILE_CHROMIUM_ARGS/)
  assert.throws(() => profileOptions({ PROFILE_CHROMIUM_ARGS: '[' }), SyntaxError)
})

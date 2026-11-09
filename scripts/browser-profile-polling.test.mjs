import test from 'node:test'
import assert from 'node:assert/strict'
import { startProfilePolling } from './browser-profile-polling.mjs'

test(
  'stopping cancels a pending polling delay without waiting for the interval',
  { timeout: 1000 },
  async () => {
    const stop = startProfilePolling(() => assert.fail('Unexpected sample'), 2500)
    await stop()
    await stop()
  },
)

test('stopping joins an in-flight sample before a checkpoint can start', async () => {
  const entered = Promise.withResolvers()
  const release = Promise.withResolvers()
  let calls = 0
  const stop = startProfilePolling(async () => {
    calls++
    entered.resolve()
    await release.promise
  }, 0)
  await entered.promise
  let stopped = false
  const joined = stop().then(() => {
    stopped = true
  })
  await new Promise(setImmediate)
  assert.equal(stopped, false)
  release.resolve()
  await joined
  assert.equal(calls, 1)
})

test('joining a poller surfaces a failed sample', async () => {
  const entered = Promise.withResolvers()
  const stop = startProfilePolling(() => {
    entered.resolve()
    throw new Error('Sample failed')
  }, 0)
  await entered.promise
  await assert.rejects(stop(), /Sample failed/)
})

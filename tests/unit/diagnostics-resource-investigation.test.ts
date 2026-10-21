import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ResourceInvestigation } from '../../src/features/diagnostics/resource-investigation'
import { DiagnosticRecorder, diagnostics } from '../../src/features/diagnostics/recorder'
import ResourcePanel from '../../src/features/diagnostics/ResourceInvestigation.vue'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  diagnostics.pause()
  diagnostics.reset()
})
it('bounds request history/pending work, records stages once and discards old session completions', () => {
  let now = 10
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const r = new ResourceInvestigation()
  expect(r.begin('pdf.render-request')).toBeUndefined()
  r.resume()
  const request = r.begin('pdf.render-request')!
  now = 20
  request.start()
  now = 35
  request.finish()
  request.finish('failed')
  expect(r.snapshot({}, null).timings).toEqual([
    {
      operation: 'pdf.render-request',
      queuedAtMs: 10,
      endedAtMs: 35,
      waitMs: 10,
      processingMs: 15,
      durationMs: 25,
      outcome: 'completed',
      failure: null,
    },
  ])
  for (let i = 0; i < 130; i++) r.begin('pdf.render-request')?.finish('cancelled')
  expect(r.snapshot({}, null).timings).toHaveLength(120)
  const pending = Array.from({ length: 120 }, () => r.begin('reading.transaction'))
  expect(r.begin('reading.transaction')).toBeUndefined()
  expect(r.snapshot({}, null).dropped).toBe(1)
  r.pause()
  r.resume()
  pending.forEach((p) => p?.finish())
  expect(r.snapshot({}, null).pending).toHaveLength(0)
  const late = r.begin('workspace.transaction')!
  r.reset()
  late.start()
  late.finish()
  expect(r.snapshot({}, null).timings).toHaveLength(0)
})
it('compares explicit ownership and heap without retaining identities, and clears the baseline on reset', () => {
  const r = new DiagnosticRecorder()
  r.resume()
  const owner = { path: '/PRIVATE', title: 'SECRET' }
  r.resources(owner, { viewers: 1, blobURLs: 2, blobBytes: 120 })
  r.investigation.markBaseline(r.snapshot().resources, 100)
  r.release(owner)
  const result = r.investigation.snapshot(r.snapshot().resources, 130)
  expect(result.comparison.find((row) => row.key === 'viewers')).toEqual({
    key: 'viewers',
    current: 0,
    baseline: 1,
    delta: -1,
    registration: 'No registered owner',
  })
  expect(result.heap.deltaBytes).toBe(30)
  expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE/)
  result.baseline!.resources.viewers = 99
  expect(r.investigation.snapshot({}, null).baseline!.resources.viewers).toBe(1)
  expect(r.investigation.snapshot({}, null).heap.deltaBytes).toBeNull()
  r.reset()
  expect(r.investigation.snapshot({}, 100).baseline).toBeNull()
})
it('records fixed cache counters only while active, and keeps negative/unsupported heap unavailable', () => {
  const r = new ResourceInvestigation()
  r.cache('preview', 'hits')
  r.resume()
  r.cache('preview', 'hits')
  r.cache('dimensions', 'misses')
  r.cache('preview', 'evictions')
  r.pause()
  r.cache('preview', 'hits')
  expect(r.snapshot({}, null).caches).toEqual({
    preview: { hits: 1, misses: 0, evictions: 1 },
    dimensions: { hits: 0, misses: 1, evictions: 0 },
  })
  r.markBaseline({}, -1)
  expect(r.snapshot({}, NaN).heap).toEqual({
    currentBytes: null,
    baselineBytes: null,
    deltaBytes: null,
  })
})
it('samples only safe origin storage fields, guards stale/paused/reset completions and maps failures', async () => {
  const r = new ResourceInvestigation()
  r.resume()
  let resolve!: (v: StorageEstimate) => void
  const estimate = vi.fn(() => new Promise<StorageEstimate>((done) => (resolve = done)))
  vi.stubGlobal('navigator', { storage: { estimate } })
  vi.stubGlobal('isSecureContext', true)
  const pending = r.refreshStorage()
  r.pause()
  r.resume()
  resolve(Object.assign({ usage: 100, quota: 200 }, { usageDetails: { PRIVATE: 1 } }))
  await pending
  expect(r.snapshot({}, null).storage.usageBytes).toBeNull()
  const first = r.refreshStorage()
  const old = resolve
  const second = r.refreshStorage()
  resolve(Object.assign({ usage: 0, quota: 200 }, { usageDetails: { PRIVATE: 1 } }))
  await second
  old({ usage: 99, quota: 300 })
  await first
  expect(r.snapshot({}, null).storage).toMatchObject({ usageBytes: 0, quotaBytes: 200 })
  expect(JSON.stringify(r.snapshot({}, null))).not.toContain('PRIVATE')
  estimate.mockRejectedValue(new DOMException('/PRIVATE', 'SecurityError'))
  await r.refreshStorage()
  expect(r.snapshot({}, null).storage.status).toContain('security restriction')
  vi.stubGlobal('navigator', {})
  await r.refreshStorage()
  expect(r.snapshot({}, null).storage.status).toContain('unsupported')
  vi.stubGlobal('isSecureContext', false)
  await r.refreshStorage()
  expect(r.snapshot({}, null).storage.status).toContain('secure context')
})
it('tracks IndexedDB connection wait and commit rather than staged result and maps quota failure without its message', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  diagnostics.resume()
  const transaction = {
    objectStore: () => ({}),
    oncomplete: null as (() => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onabort: null as (() => void) | null,
    error: null,
  }
  const db = { transaction: () => transaction, close: vi.fn() }
  const open = { result: db, onsuccess: null as (() => void) | null }
  vi.stubGlobal('indexedDB', { open: () => open })
  const database = new ReadingMetadataDatabase('PRIVATE')
  const pending = database.transaction((_s, done) => done('SECRET'))
  now = 10
  open.onsuccess?.()
  await Promise.resolve()
  expect(diagnostics.investigation.snapshot({}, null).pending[0]!.phase).toBe('processing')
  now = 30
  transaction.oncomplete?.()
  await expect(pending).resolves.toBe('SECRET')
  expect(diagnostics.investigation.snapshot({}, null).timings[0]).toMatchObject({
    operation: 'reading.transaction',
    waitMs: 10,
    processingMs: 20,
    outcome: 'completed',
  })
  const failed = database.transaction(() => {})
  open.onsuccess?.()
  await Promise.resolve()
  const event = new Event('error')
  Object.defineProperty(event, 'target', {
    value: { error: new DOMException('/PRIVATE/file', 'QuotaExceededError') },
  })
  transaction.onerror?.(event)
  await expect(failed).rejects.toThrow('/PRIVATE/file')
  const snapshot = diagnostics.investigation.snapshot({}, null)
  expect(snapshot.timings.at(-1)!.outcome).toBe('failed')
  expect(snapshot.timings.at(-1)!.failure).toBe('quota')
  expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|SECRET/)
  expect(db.close).toHaveBeenCalledTimes(2)
})
it('explains estimate scope and emits baseline/storage controls without leak or CPU claims', async () => {
  const r = new ResourceInvestigation()
  r.resume()
  const wrapper = mount(ResourcePanel, { props: { snapshot: r.snapshot({}, null) } })
  expect(wrapper.text()).toContain('No registered owner')
  expect(wrapper.text()).toContain('Unavailable')
  expect(wrapper.text()).toContain('five minutes')
  const mark = wrapper.findAll('button').find((b) => b.text() === 'Mark baseline')!
  await mark.trigger('click')
  expect(wrapper.emitted('mark')).toHaveLength(1)
  expect(
    wrapper
      .findAll('button')
      .find((b) => b.text() === 'Clear baseline')!
      .attributes('disabled'),
  ).toBeDefined()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Refresh storage estimate')!
    .trigger('click')
  expect(wrapper.emitted('storage')).toHaveLength(1)
  wrapper.unmount()
})

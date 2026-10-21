import { afterEach, expect, it, vi } from 'vitest'
import { OwnedRegistrations } from '../../src/features/diagnostics/owned-registrations'
import { diagnostics } from '../../src/features/diagnostics/recorder'
import { ResourceInvestigation } from '../../src/features/diagnostics/resource-investigation'
import { DocumentSessions } from '../../src/features/reader/document-sessions'
import { bindPdfTextSelection } from '../../src/features/pdf/text-selection'

const evidence = () => diagnostics.investigation.snapshot(diagnostics.snapshot().resources, null)
afterEach(() => {
  diagnostics.pause()
  diagnostics.reset()
  diagnostics.owners.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('counts explicit live registrations across pause/reset and rejects disposed owner resurrection', () => {
  const owner = new OwnedRegistrations()
  owner.set('ownedListeners', 3)
  owner.set('ownedObservers', 1)
  diagnostics.resume()
  diagnostics.investigation.markBaseline(diagnostics.snapshot().resources, null)
  diagnostics.pause()
  owner.set('ownedListeners', 2)
  diagnostics.reset()
  expect(diagnostics.snapshot().resources.ownedListeners).toBe(2)
  owner.dispose()
  owner.dispose()
  owner.set('ownedListeners', 100)
  expect(diagnostics.snapshot().resources.ownedListeners).toBeUndefined()
})
it('counts one shared PDF selection guard and releases it only after the final layer', () => {
  const first = document.createElement('div'),
    second = document.createElement('div')
  const a = bindPdfTextSelection(first),
    b = bindPdfTextSelection(second)
  expect(diagnostics.snapshot().resources.ownedListeners).toBe(8)
  a()
  expect(diagnostics.snapshot().resources.ownedListeners).toBe(8)
  b()
  expect(diagnostics.snapshot().resources.ownedListeners).toBeUndefined()
})
const doc = (id: string) => ({
  id,
  name: 'SECRET',
  format: 'PDF' as const,
  file: new File(['private'], 'SECRET.pdf'),
  relativePath: id,
  parentPath: '',
  source: 'file-input' as const,
})
it('tracks scheduled retention timers and release delay without blocking activation or retaining IDs', async () => {
  vi.useFakeTimers()
  diagnostics.resume()
  const sessions = new DocumentSessions()
  await sessions.open(doc('PRIVATE'))
  const first = sessions.active!
  let resolve!: () => void
  const pending = new Promise<void>((done) => {
    resolve = done
  })
  sessions.attach(first.session.id, first.generation, {
    capture: () => ({ panel: null, query: '' }),
    dispose: () => pending,
  })
  sessions.update(first.session.id, first.generation, 'ready')
  await sessions.open(doc('SECOND'))
  expect(diagnostics.snapshot().resources.ownedTimers).toBe(1)
  await vi.advanceTimersByTimeAsync(300000)
  expect(diagnostics.snapshot().resources.ownedTimers).toBeUndefined()
  expect(evidence().pending.some((r) => r.operation === 'pdf.reader-release')).toBe(true)
  await vi.advanceTimersByTimeAsync(20)
  resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(evidence().timings.find((r) => r.operation === 'pdf.reader-release')).toMatchObject({
    outcome: 'completed',
    processingMs: 20,
  })
  expect(JSON.stringify(evidence())).not.toMatch(/PRIVATE|SECRET|reader-session-/)
  await sessions.reset()
  expect(vi.getTimerCount()).toBe(0)
})
it('retains failed release outcome without propagating it into later reader activation', async () => {
  diagnostics.resume()
  const sessions = new DocumentSessions()
  await sessions.open(doc('a'))
  const a = sessions.active!
  sessions.attach(a.session.id, a.generation, {
    capture: () => ({ panel: null, query: '' }),
    dispose: async () => {
      throw new Error('PRIVATE')
    },
  })
  await sessions.close(a.session.id)
  await sessions.open(doc('b'))
  await Promise.resolve()
  expect(sessions.active?.document.id).toBe('b')
  expect(evidence().timings.find((r) => r.operation === 'pdf.reader-release')).toMatchObject({
    outcome: 'failed',
    failure: 'other',
  })
  await sessions.reset()
})
function memoryApi(run: () => Promise<unknown>) {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('crossOriginIsolated', true)
  Object.defineProperty(performance, 'measureUserAgentSpecificMemory', {
    value: run,
    configurable: true,
  })
}
afterEach(() => {
  Reflect.deleteProperty(performance, 'measureUserAgentSpecificMemory')
})
it('manually samples only numeric total bytes, without accessing private attribution breakdowns', async () => {
  const measure = vi.fn(async () => ({
    bytes: 1234,
    get breakdown() {
      throw new Error('PRIVATE')
    },
  }))
  memoryApi(measure)
  const r = new ResourceInvestigation()
  await r.refreshPageMemory()
  expect(measure).not.toHaveBeenCalled()
  r.resume()
  await r.refreshPageMemory()
  expect(measure).toHaveBeenCalledOnce()
  const result = r.snapshot({}, null)
  expect(result.pageMemory).toMatchObject({ bytes: 1234, pending: false })
  expect(result.pageMemory.observedAtMs).not.toBeNull()
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|breakdown|attributionURL/)
})
it('does not overlap native memory requests; pause/reset discard late results even after resume', async () => {
  let resolve!: (v: unknown) => void
  const measure = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  memoryApi(measure)
  const r = new ResourceInvestigation()
  r.resume()
  const pending = r.refreshPageMemory()
  r.pause()
  r.reset()
  r.resume()
  await r.refreshPageMemory()
  expect(measure).toHaveBeenCalledOnce()
  expect(r.snapshot({}, null).pageMemory.pending).toBe(true)
  resolve({ bytes: 5678 })
  await pending
  expect(r.snapshot({}, null).pageMemory.bytes).toBeNull()
  expect(r.snapshot({}, null).pageMemory.pending).toBe(false)
})
it.each(['insecure', 'unisolated', 'unsupported', 'rejected', 'invalid'] as const)(
  'shows %s page memory as unavailable without fabricated zeros or private errors',
  async (kind) => {
    const measure = vi.fn(async () => {
      if (kind === 'rejected') throw new Error('/PRIVATE')
      return { bytes: NaN }
    })
    memoryApi(measure)
    if (kind === 'insecure') vi.stubGlobal('isSecureContext', false)
    if (kind === 'unisolated') vi.stubGlobal('crossOriginIsolated', false)
    if (kind === 'unsupported')
      Reflect.deleteProperty(performance, 'measureUserAgentSpecificMemory')
    const r = new ResourceInvestigation()
    r.resume()
    await r.refreshPageMemory()
    expect(r.snapshot({}, null).pageMemory.bytes).toBeNull()
    expect(r.snapshot({}, null).pageMemory.status).toMatch(/Unavailable/)
    expect(JSON.stringify(r.snapshot({}, null))).not.toContain('PRIVATE')
    if (['insecure', 'unisolated', 'unsupported'].includes(kind))
      expect(measure).not.toHaveBeenCalled()
  },
)

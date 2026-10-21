import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagnosticRecorder, diagnostics, LIMIT } from '../../src/features/diagnostics/recorder'
import { capabilities, startSampler } from '../../src/features/diagnostics/sampler'
import { discoverDocuments } from '../../src/features/library/discovery'

afterEach(() => {
  diagnostics.pause()
  diagnostics.reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('bounded private diagnostic recording', () => {
  it('bounds retention and pending work; pause/reset prevent late completions entering a new session', () => {
    const recorder = new DiagnosticRecorder()
    expect(recorder.start('pdf.render')).toBeUndefined()
    recorder.resume()
    for (let index = 0; index < LIMIT + 5; index++) recorder.start('pdf.render')?.()
    expect(recorder.snapshot().timings).toHaveLength(LIMIT)
    const late = recorder.start('pdf.render')
    recorder.pause()
    late?.()
    expect(recorder.snapshot().pending.render).toBe(0)
    recorder.resume()
    const beforeReset = recorder.start('epub.chapter')
    const oldSession = recorder.session
    recorder.reset()
    beforeReset?.()
    expect(recorder.session).not.toBe(oldSession)
    expect(recorder.timings).toHaveLength(0)
    const finishes = Array.from({ length: LIMIT }, () => recorder.start('pdf.render'))
    expect(recorder.start('pdf.render')).toBeUndefined()
    expect(recorder.dropped).toBe(1)
    finishes.forEach((finish) => finish?.('cancelled'))
    expect(recorder.cancelled).toBe(LIMIT)
  })
  it('removes disposed owners and serializes counts rather than the owner object', () => {
    const recorder = new DiagnosticRecorder()
    const privateOwner = { title: 'secret.pdf', path: '/private', annotation: 'secret text' }
    recorder.resources(privateOwner, { viewers: 1, blobURLs: 4 })
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/secret|private|annotation/)
    expect(recorder.snapshot().resources).toEqual({ viewers: 1, blobURLs: 4 })
    recorder.release(privateOwner)
    recorder.release(privateOwner)
    expect(recorder.snapshot().resources).toEqual({})
  })
  it('records actual library milestones and cancellation without file metadata', async () => {
    diagnostics.resume()
    const files = [new File(['private content'], 'secret.pdf')]
    await discoverDocuments({ kind: 'files', source: 'file-input', files })
    expect(diagnostics.timings.map((value) => value.metric)).toEqual([
      'library.first-listing',
      'library.scan',
    ])
    const controller = new AbortController()
    controller.abort()
    await discoverDocuments(
      { kind: 'files', source: 'file-input', files },
      { signal: controller.signal },
    )
    expect(diagnostics.timings.some((value) => value.outcome === 'cancelled')).toBe(true)
    expect(JSON.stringify(diagnostics.snapshot())).not.toMatch(/secret|private content/)
    expect(diagnostics.snapshot().pending.index).toBe(0)
  })
})
describe('capability fallback and sampler teardown', () => {
  it('uses null with reasons for unavailable APIs and stops all sampling on shutdown', () => {
    vi.useFakeTimers()
    vi.stubGlobal('PerformanceObserver', undefined)
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    expect(capabilities().longTasks).toMatch(/Unavailable/)
    expect(capabilities().memory).toMatch(/Unavailable/)
    diagnostics.resume()
    const update = vi.fn()
    const sampler = startSampler(update)
    vi.advanceTimersByTime(121000)
    expect(diagnostics.samples).toHaveLength(LIMIT)
    expect(diagnostics.samples[0]).toEqual({
      observedAtMs: expect.any(Number),
      frameIntervalMs: null,
      longTaskMs: null,
      jsHeapBytes: null,
    })
    expect(update).toHaveBeenCalledTimes(121)
    sampler.stop()
    diagnostics.pause()
    vi.advanceTimersByTime(3000)
    expect(update).toHaveBeenCalledTimes(121)
    expect(vi.getTimerCount()).toBe(0)
  })
})

it('disconnects supported observers and animation frames and cancels deferred lifecycle measurements', () => {
  vi.useFakeTimers()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = ['longtask']
      observe() {}
      disconnect = disconnect
    },
  )
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 17),
  )
  const cancel = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancel)
  diagnostics.resume()
  const stopWork = vi.fn()
  diagnostics.onStop(stopWork)
  const sampler = startSampler(() => {})
  sampler.stop()
  diagnostics.pause()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(cancel).toHaveBeenCalledWith(17)
  expect(stopWork).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('does not report a background-tab pause as a foreground frame interval', () => {
  vi.useFakeTimers()
  let frame: FrameRequestCallback = () => {}
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback
    return 17
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  diagnostics.resume()
  const sampler = startSampler(() => {})
  frame(10)
  frame(30)
  document.dispatchEvent(new Event('visibilitychange'))
  frame(10000)
  frame(10020)
  vi.advanceTimersByTime(1000)
  expect(diagnostics.samples[0]?.frameIntervalMs).toBe(20)
  sampler.stop()
})

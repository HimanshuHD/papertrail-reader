import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponsivenessSensors } from '../../src/features/diagnostics/responsiveness'

let now = 10
let hidden = false
const observers: FakeObserver[] = []
class FakeObserver {
  static supportedEntryTypes = ['event', 'long-animation-frame', 'resource']
  kind = ''
  disconnected = false
  options: PerformanceObserverInit | undefined
  constructor(private callback: PerformanceObserverCallback) {
    observers.push(this)
  }
  observe(options: PerformanceObserverInit) {
    this.options = options
    this.kind = options.type!
  }
  disconnect() {
    this.disconnected = true
  }
  takeRecords() {
    return []
  }
  emit(entries: object[]) {
    this.callback(
      { getEntries: () => entries } as PerformanceObserverEntryList,
      this as unknown as PerformanceObserver,
    )
  }
}
function setup() {
  observers.length = 0
  now = 10
  hidden = false
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.stubGlobal('PerformanceObserver', FakeObserver)
  const sensors = new ResponsivenessSensors()
  return sensors
}
const input = (interactionId = 1, startTime = 11) => ({
  startTime,
  duration: 64,
  interactionId,
  processingStart: startTime + 10,
  processingEnd: startTime + 30,
  name: 'PRIVATE',
  target: { textContent: 'SECRET' },
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('opt-in bounded responsiveness sensors', () => {
  it('starts lazily with non-buffered thresholded observers and projects consistent grouped events', () => {
    const s = setup()
    expect(observers).toHaveLength(0)
    expect(s.snapshot().capabilities.event).toContain('Disabled')
    s.start()
    s.start()
    expect(observers).toHaveLength(3)
    expect(observers[0]!.options).toEqual({ type: 'event', buffered: false, durationThreshold: 16 })
    observers[0]!.emit([
      input(),
      { ...input(), duration: 32 },
      input(0),
      { ...input(2), processingEnd: 1 },
    ])
    expect(s.snapshot().inputs).toEqual([{ atMs: 11, durationMs: 64, waitMs: 10, handlerMs: 20 }])
    expect(JSON.stringify(s.snapshot())).not.toMatch(/PRIVATE|SECRET|interactionId|target/)
    s.stop()
  })
  it('bounds each queue and callback processing, rejecting malformed fields and old entries', () => {
    const s = setup()
    s.start()
    observers[0]!.emit(Array.from({ length: 130 }, (_, i) => input(i + 1)))
    observers[0]!.emit([
      input(200, 1),
      { ...input(201), duration: Infinity },
      { ...input(202), interactionId: NaN },
    ])
    expect(s.snapshot().inputs).toHaveLength(120)
    expect(s.snapshot().overhead.dropped).toBe(10)
    expect(s.snapshot().inputs[0]!.atMs).toBe(11)
    for (let i = 0; i < 130; i++) {
      observers[1]!.emit([{ startTime: 11, duration: 80 }])
      observers[2]!.emit([{ startTime: 11, duration: 4 }])
    }
    expect(s.snapshot().frames).toHaveLength(120)
    expect(s.snapshot().resources).toHaveLength(120)
    expect(s.snapshot().frames[0]!.blockingMs).toBeNull()
    expect(s.snapshot().frames[0]!.scriptMs).toEqual({ event: null, callback: null, other: null })
    expect(s.snapshot().resources[0]!.transferBytes).toBeNull()
    s.stop()
  })
  it('drops private resource/script attribution and keeps partial phase data nullable', () => {
    const s = setup()
    s.start()
    observers[1]!.emit([
      {
        startTime: 11,
        duration: 100,
        blockingDuration: 40,
        renderStart: 81,
        styleAndLayoutStart: 91,
        scripts: [
          {
            invokerType: 'event-listener',
            duration: 60,
            forcedStyleAndLayoutDuration: 12,
            sourceURL: '/SECRET.pdf',
            sourceFunctionName: 'PRIVATE',
            invoker: 'SECRET',
          },
        ],
      },
    ])
    observers[2]!.emit([
      {
        startTime: 11,
        duration: 50,
        name: 'https://SECRET/private.pdf',
        initiatorType: 'PRIVATE',
        transferSize: 0,
        encodedBodySize: 20,
      },
    ])
    expect(s.snapshot().frames[0]).toMatchObject({
      blockingMs: 40,
      renderingMs: 30,
      styleLayoutMs: 20,
      forcedLayoutMs: 12,
      scriptMs: { event: 60, callback: 0, other: 0 },
    })
    expect(s.snapshot().resources[0]).toMatchObject({
      category: 'other',
      transferBytes: 0,
      encodedBytes: 20,
    })
    expect(JSON.stringify(s.snapshot())).not.toMatch(/SECRET|PRIVATE|sourceURL|sourceFunctionName/)
    const copy = s.snapshot()
    copy.frames[0]!.scriptMs.event = 999
    expect(s.snapshot().frames[0]!.scriptMs.event).toBe(60)
    s.stop()
  })
  it('ignores background, pre-resume and late callbacks; preserves readings until reset', () => {
    const s = setup()
    s.start()
    const old = observers[0]!
    old.emit([input()])
    hidden = true
    now = 20
    document.dispatchEvent(new Event('visibilitychange'))
    old.emit([input(2, 21)])
    hidden = false
    now = 30
    document.dispatchEvent(new Event('visibilitychange'))
    old.emit([input(3, 21), input(4, 31)])
    expect(s.snapshot().inputs).toHaveLength(2)
    s.stop()
    old.emit([input(5, 32)])
    expect(observers.every((o) => o.disconnected)).toBe(true)
    s.start()
    old.emit([input(6, 35)])
    expect(s.snapshot().inputs).toHaveLength(2)
    s.reset()
    expect(s.snapshot().inputs).toHaveLength(0)
    expect(s.snapshot().overhead.callbacks).toBe(0)
    expect(s.snapshot().active).toBe(false)
  })
  it('reports unsupported and actual initialization failures without copying exception messages', () => {
    const s = setup()
    vi.stubGlobal('PerformanceObserver', undefined)
    s.start()
    expect(Object.values(s.snapshot().capabilities).every((v) => v.includes('Unavailable'))).toBe(
      true,
    )
    s.stop()
    vi.stubGlobal(
      'PerformanceObserver',
      class extends FakeObserver {
        observe() {
          throw new DOMException('/PRIVATE/path', 'SecurityError')
        }
      },
    )
    s.start()
    expect(s.snapshot().capabilities.event).toContain('security restriction')
    expect(observers.every((o) => o.disconnected)).toBe(true)
    expect(JSON.stringify(s.snapshot())).not.toContain('PRIVATE')
    s.stop()
  })
  it('discloses secure-context, top-level and partial iframe/worker coverage without accessing frames', () => {
    const s = setup()
    expect(s.snapshot().scope.secureContext).toBe(window.isSecureContext === true)
    expect(s.snapshot().scope.frame).toBe('top-level')
    expect(s.snapshot().scope.coverage).toContain('iframe/worker')
    expect(s.snapshot().scope.eventTiming).toContain('Not page INP')
  })
})

it('reports embedded insecure contexts and generic observer failures without frame access', () => {
  const s = setup()
  vi.stubGlobal('window', { top: {}, self: {}, isSecureContext: false })
  vi.stubGlobal(
    'PerformanceObserver',
    class extends FakeObserver {
      observe() {
        throw new Error('PRIVATE')
      }
    },
  )
  s.start()
  expect(s.snapshot().scope.frame).toBe('embedded frame')
  expect(s.snapshot().scope.secureContext).toBe(false)
  expect(s.snapshot().capabilities.event).toBe('Unavailable: observer initialization failed')
  expect(JSON.stringify(s.snapshot())).not.toContain('PRIVATE')
  s.stop()
})

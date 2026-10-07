import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { ActiveReadingTime } from '../features/reading/active-time'
import {
  ReadingStatisticsStorage,
  ReadingStatisticsResetError,
  type ReadingStatistics,
  type StatisticsHandle,
} from '../services/reading-statistics'

type Visit = {
  fingerprint: string
  handle: StatisticsHandle
  clock: ActiveReadingTime
  position: number
  savedMs: number
  baseMs: number
}
export function useReadingStatistics(
  format: 'PDF' | 'EPUB',
  fingerprint: Ref<string | null>,
  ready: Ref<boolean>,
  position: Ref<number>,
) {
  const storage = new ReadingStatisticsStorage()
  const summary = ref<ReadingStatistics | null>(null)
  const activeMs = ref(0)
  const notice = ref('')
  const idle = ref(false)
  const resetting = ref(false)
  let current: Visit | null = null,
    owner = 0,
    timer: ReturnType<typeof setInterval> | undefined
  let pageHidden = false
  let queue = Promise.resolve()
  const now = () => performance.now()
  function eligible() {
    return (
      !pageHidden && ready.value && document.visibilityState === 'visible' && document.hasFocus()
    )
  }
  function tick(reconcile = true) {
    const visit = current
    if (!visit) return
    // Window focus events may fire before hasFocus updates, or be missed entirely.
    // Reconcile on every heartbeat so a transient false cannot latch the clock paused.
    if (reconcile) visit.clock.setEligible(eligible(), now())
    else visit.clock.tick(now())
    activeMs.value = visit.baseMs + Math.floor(visit.clock.activeMs)
    idle.value = visit.clock.isIdle(now())
    if (ready.value && visit.fingerprint === fingerprint.value)
      visit.position = Math.min(1, Math.max(0, position.value))
  }
  function flush(visit = current) {
    if (!visit) return queue
    visit.clock.tick(now())
    const ms = Math.floor(visit.clock.activeMs),
      point = visit.position
    queue = queue.then(async () => {
      try {
        const saved = await storage.checkpoint(visit.handle, ms, point)
        if (current === visit) {
          summary.value = saved
          visit.baseMs = saved.activeMs - ms
          visit.savedMs = ms
          notice.value = ''
        }
      } catch (error) {
        if (current === visit && error instanceof ReadingStatisticsResetError) {
          current = null
          summary.value = null
          activeMs.value = 0
          owner++
          notice.value = 'Insights were reset in another tab. Retry to start a new reading visit.'
        } else if (current === visit)
          notice.value = 'Reading insights could not be saved. Retry to keep this session.'
      }
    })
    return queue
  }
  function updateEligibility(event?: Event) {
    if (event?.type === 'pagehide') pageHidden = true
    else if (event?.type === 'pageshow') pageHidden = false
    current?.clock.setEligible(
      event?.type === 'blur' || event?.type === 'pagehide' ? false : eligible(),
      now(),
    )
    tick(false)
    void flush()
  }
  function activity(event: Event) {
    if (!current || !eligible()) return
    const target = event.target as Element | null
    if (
      target?.closest?.(
        '[aria-label="PDF reader"], [aria-label="EPUB reader"], [data-reader-activity]',
      ) ||
      event.type === 'reader-activity'
    ) {
      current.clock.setEligible(true, now())
      current.clock.activity(now())
      tick()
    }
  }
  async function open() {
    const generation = ++owner
    current?.clock.setEligible(false, now())
    await flush()
    if (generation !== owner) return
    current = null
    summary.value = null
    activeMs.value = 0
    notice.value = ''
    idle.value = false
    const digest = fingerprint.value
    if (!digest) return
    try {
      const opened = await storage.open({ format, fingerprint: digest })
      if (generation !== owner) return
      current = {
        fingerprint: digest,
        handle: opened.handle,
        clock: new ActiveReadingTime(now()),
        position: position.value,
        savedMs: 0,
        baseMs: opened.summary.activeMs,
      }
      summary.value = opened.summary
      current.clock.setEligible(eligible(), now())
      tick()
    } catch {
      if (generation === owner)
        notice.value = 'Local reading insights are unavailable. Retry when storage is available.'
    }
  }
  watch(fingerprint, () => void open(), { immediate: true })
  watch(ready, () => updateEligibility())
  watch(position, () => tick())
  async function reset() {
    if (!current || resetting.value) return
    resetting.value = true
    const visit = current
    visit.clock.setEligible(false, now())
    await flush(visit)
    try {
      const result = await storage.reset(visit.handle)
      if (current === visit) {
        current = {
          fingerprint: visit.fingerprint,
          handle: result.handle,
          clock: new ActiveReadingTime(now()),
          position: position.value,
          savedMs: 0,
          baseMs: 0,
        }
        summary.value = result.summary
        activeMs.value = 0
        notice.value = ''
        idle.value = false
        current.clock.setEligible(eligible(), now())
      }
    } catch {
      if (current === visit) {
        notice.value = 'Reading insights could not be reset. Reopen this document to retry.'
        visit.clock.setEligible(eligible(), now())
      }
    } finally {
      resetting.value = false
    }
  }
  function retry() {
    if (current) void flush()
    else void open()
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', updateEligibility)
    window.addEventListener('focus', updateEligibility)
    window.addEventListener('blur', updateEligibility)
    window.addEventListener('pagehide', updateEligibility)
    window.addEventListener('pageshow', updateEligibility)
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'reader-activity'])
      document.addEventListener(event, activity, { passive: true })
    timer = setInterval(() => {
      tick()
      if (current && !notice.value && current.clock.activeMs - current.savedMs >= 15_000)
        void flush()
    }, 1000)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    const visit = current
    if (visit) {
      visit.clock.setEligible(false, now())
      void flush(visit)
    }
    current = null
    owner++
    document.removeEventListener('visibilitychange', updateEligibility)
    window.removeEventListener('focus', updateEligibility)
    window.removeEventListener('blur', updateEligibility)
    window.removeEventListener('pagehide', updateEligibility)
    window.removeEventListener('pageshow', updateEligibility)
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'reader-activity'])
      document.removeEventListener(event, activity)
  })
  return { summary, activeMs, idle, notice, resetting, reset, retry }
}

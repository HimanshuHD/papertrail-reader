import { setTimeout as delay } from 'node:timers/promises'

/** Cancel an idle wait immediately, then join any sample already in flight. */
export function startProfilePolling(sample, intervalMs) {
  const controller = new AbortController()
  const { signal } = controller
  const loop = (async () => {
    while (!signal.aborted) {
      try {
        await delay(intervalMs, undefined, { signal })
      } catch (error) {
        if (signal.aborted && error.name === 'AbortError') return
        throw error
      }
      if (!signal.aborted) await sample()
    }
  })()
  // The caller observes errors when it joins the poller at a checkpoint.
  loop.catch(() => {})
  return async () => {
    controller.abort()
    await loop
  }
}

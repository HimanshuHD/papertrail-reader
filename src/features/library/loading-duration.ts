/** The display minimum applies only to successful discovery; cancellation always wins. */
export async function waitForMinimumLoading(
  startedAt: number,
  signal: AbortSignal,
  minimumMs = 3000,
): Promise<void> {
  const remaining = Math.max(0, minimumMs - (Date.now() - startedAt))
  if (signal.aborted || remaining === 0) return
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, remaining)
    signal.addEventListener('abort', finish, { once: true })
  })
}

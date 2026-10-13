export type StartupStage = 'library' | 'reader'
export type StartupTask = 'resources' | 'route' | 'library' | 'reader'
export type StartupScreen = {
  stage: (stage: StartupStage, message: string) => void
  complete: (task: StartupTask) => void
  ready: () => void
  fail: () => void
}

/** Production reports completed startup steps; preview alone gets a review timeline. */
export function createStartupScreen(root: HTMLElement | null, preview = false): StartupScreen {
  let settled = false
  let initialized = false
  let removal: ReturnType<typeof setTimeout> | undefined
  let finish: ReturnType<typeof setTimeout> | undefined
  let ticker: ReturnType<typeof setInterval> | undefined
  const started = Date.now()
  const completed = new Set<StartupTask>()
  const stages = ['library', 'reader', 'ready']
  function progress(value: number) {
    if (!root || settled || root.dataset.state === 'error') return
    const bar = root.querySelector<HTMLElement>('[role="progressbar"]')
    bar?.setAttribute('aria-valuenow', String(value))
    bar?.setAttribute(
      'aria-valuetext',
      preview
        ? value + '% of preview review time'
        : completed.size + ' of 4 startup steps complete',
    )
    bar?.style.setProperty('--startup-progress', value + '%')
    const number = root.querySelector('[data-startup-percent]')
    if (number) number.textContent = value + '%'
  }
  if (root) {
    root.dataset.mode = preview ? 'preview' : 'startup'
    const caption = root.querySelector('[data-progress-caption]')
    if (caption)
      caption.textContent = preview ? 'Animation preview · 7-second review' : 'Startup steps'
    progress(0)
    if (preview)
      ticker = setInterval(
        () => progress(Math.min(99, Math.floor((Date.now() - started) / 70))),
        50,
      )
  }
  function complete(task: StartupTask) {
    if (settled || root?.dataset.state === 'error') return
    completed.add(task)
    if (!preview) progress(completed.size * 25)
  }
  function stage(stage: StartupStage, message: string) {
    if (!root || settled || initialized || root.dataset.state === 'error') return
    root.dataset.stage = stage
    const status = root.querySelector('[data-startup-status]')
    if (status) status.textContent = message
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((item) => {
      const active = item.dataset.step === stage
      item.dataset.state = active
        ? 'current'
        : stages.indexOf(item.dataset.step!) < stages.indexOf(stage)
          ? 'done'
          : 'pending'
      if (active) item.setAttribute('aria-current', 'step')
      else item.removeAttribute('aria-current')
    })
  }
  function dismiss() {
    if (!root || settled || root.dataset.state === 'error') return
    progress(100)
    settled = true
    clearInterval(ticker)
    clearTimeout(finish)
    root.dataset.state = 'ready'
    root.setAttribute('aria-busy', 'false')
    root.setAttribute('aria-hidden', 'true')
    root.inert = true
    document.getElementById('app')?.removeAttribute('inert')
    clearTimeout(removal)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) root.remove()
    else removal = setTimeout(() => root.remove(), 180)
    window.dispatchEvent(new Event('papertrail-startup-ready'))
  }
  function ready() {
    if (!root || settled || initialized || root.dataset.state === 'error') return
    initialized = true
    complete('reader')
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((item) => {
      item.dataset.state = item.dataset.step === 'ready' ? 'current' : 'done'
      if (item.dataset.step === 'ready') item.setAttribute('aria-current', 'step')
      else item.removeAttribute('aria-current')
    })
    window.dispatchEvent(new Event('papertrail-startup-initialized'))
    const remaining = preview ? Math.max(0, 7000 - (Date.now() - started)) : 0
    if (remaining) {
      root.setAttribute('aria-busy', 'false')
      const status = root.querySelector('[data-startup-status]')
      if (status) status.textContent = 'Your reading space is ready · previewing the animation'
      finish = setTimeout(dismiss, remaining)
    } else dismiss()
  }
  function fail() {
    if (!root || settled) return
    clearInterval(ticker)
    clearTimeout(finish)
    root.dataset.state = 'error'
    root.setAttribute('aria-busy', 'false')
    const status = root.querySelector('[data-startup-status]')
    if (status)
      status.textContent = 'Your reading space could not finish opening. Please try again.'
    root.querySelector<HTMLElement>('[data-startup-retry]')?.removeAttribute('hidden')
  }
  return { stage, complete, ready, fail }
}

export const startupScreen = createStartupScreen(
  typeof document === 'undefined' ? null : document.getElementById('startup-loading'),
  import.meta.env.VITE_DEPLOY_CHANNEL === 'preview',
)

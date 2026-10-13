export type StartupStage = 'library' | 'reader'
export type StartupScreen = {
  stage: (stage: StartupStage, message: string) => void
  ready: () => void
  fail: () => void
}

/** One cold-start screen; document changes and later route changes do not reopen it. */
export function createStartupScreen(root: HTMLElement | null): StartupScreen {
  let settled = false
  let removal: ReturnType<typeof setTimeout> | undefined
  const stages = ['library', 'reader', 'ready']
  function stage(stage: StartupStage, message: string) {
    if (!root || settled) return
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
  function ready() {
    if (!root || settled || root.dataset.state === 'error') return
    settled = true
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
  function fail() {
    if (!root || settled) return
    root.dataset.state = 'error'
    root.setAttribute('aria-busy', 'false')
    const status = root.querySelector('[data-startup-status]')
    if (status)
      status.textContent = 'Your reading space could not finish opening. Please try again.'
    root.querySelector<HTMLElement>('[data-startup-retry]')?.removeAttribute('hidden')
  }
  return { stage, ready, fail }
}

export const startupScreen = createStartupScreen(
  typeof document === 'undefined' ? null : document.getElementById('startup-loading'),
)

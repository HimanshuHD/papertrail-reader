import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createStartupScreen } from '../../src/services/startup-screen'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML =
    '<section id="startup-loading" aria-busy="true"><p data-startup-status></p><ol><li data-step="library"></li><li data-step="reader"></li><li data-step="ready"></li></ol><button data-startup-retry hidden>Try again</button></section><div id="app" inert></div>'
})
afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
it('shows real stage status and leaves ready pending until completion', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root)
  screen.stage('reader', 'Preparing the reader')
  expect(root.querySelector('[data-step="library"]')?.getAttribute('data-state')).toBe('done')
  expect(root.querySelector('[data-step="reader"]')?.getAttribute('aria-current')).toBe('step')
  expect(root.querySelector('[data-step="ready"]')?.getAttribute('data-state')).toBe('pending')
  expect(root.querySelector('[data-startup-status]')?.textContent).toBe('Preparing the reader')
})
it('unblocks the workspace immediately, removes the screen after exit and never reopens it', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root)
  const ready = vi.fn()
  window.addEventListener('papertrail-startup-ready', ready, { once: true })
  screen.ready()
  expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false)
  expect(root.getAttribute('aria-hidden')).toBe('true')
  screen.stage('library', 'Checking your saved library')
  screen.fail()
  vi.advanceTimersByTime(180)
  expect(root.isConnected).toBe(false)
  expect(ready).toHaveBeenCalledOnce()
})
it('retains actionable startup failure instead of dismissing it as ready', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root)
  screen.fail()
  screen.ready()
  expect(root.dataset.state).toBe('error')
  expect(root.querySelector('[data-startup-retry]')?.hasAttribute('hidden')).toBe(false)
  expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true)
  vi.advanceTimersByTime(1000)
  expect(root.isConnected).toBe(true)
})
it('has no transition timer when reduced motion is requested', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const root = document.getElementById('startup-loading')!
  createStartupScreen(root).ready()
  expect(root.isConnected).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  vi.unstubAllGlobals()
})
it('is a safe no-op without an early startup element', () => {
  const screen = createStartupScreen(null)
  expect(() => {
    screen.stage('library', 'Loading')
    screen.ready()
    screen.fail()
  }).not.toThrow()
})

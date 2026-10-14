import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createStartupScreen } from '../../src/services/startup-screen'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML =
    '<section id="startup-loading" aria-busy="true"><p data-startup-status></p><span data-startup-percent></span><p data-progress-caption></p><div role="progressbar"><span></span></div><ol><li data-step="library"></li><li data-step="reader"></li><li data-step="ready"></li></ol><button data-startup-retry hidden>Try again</button></section><div id="app" inert></div>'
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

it('preview spreads review progress across seven seconds without changing production readiness', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root, true)
  screen.ready()
  vi.advanceTimersByTime(3500)
  expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50')
  expect(root.isConnected).toBe(true)
  expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true)
  vi.advanceTimersByTime(3500)
  expect(root.dataset.state).toBe('ready')
  expect(root.querySelector('[data-startup-percent]')?.textContent).toBe('100%')
  expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false)
  vi.advanceTimersByTime(180)
  expect(root.isConnected).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('preview never reports completion before genuine app readiness and does not add seven seconds afterward', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root, true)
  vi.advanceTimersByTime(10000)
  expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('99')
  expect(root.isConnected).toBe(true)
  screen.ready()
  expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false)
  vi.advanceTimersByTime(180)
  expect(root.isConnected).toBe(false)
})

it('preview failure cancels the hold and progress timers immediately', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root, true)
  screen.ready()
  vi.advanceTimersByTime(1000)
  screen.fail()
  expect(root.dataset.state).toBe('error')
  expect(root.querySelector('[data-startup-retry]')?.hasAttribute('hidden')).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  vi.advanceTimersByTime(7000)
  expect(root.isConnected).toBe(true)
})

it('normal progress advances only for distinct completed tasks, with no simulated time progression', () => {
  const root = document.getElementById('startup-loading')!
  const screen = createStartupScreen(root)
  screen.complete('resources')
  screen.complete('resources')
  vi.advanceTimersByTime(5000)
  expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25')
  screen.complete('route')
  screen.complete('library')
  expect(root.querySelector('[data-startup-percent]')?.textContent).toBe('75%')
  screen.ready()
  expect(root.dataset.state).toBe('ready')
})

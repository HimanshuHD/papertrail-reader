import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useThemeStore } from '../../src/stores/theme'
import { THEME_STORAGE_KEY } from '../../src/services/theme-preferences'
import { connectTheme } from '../../src/services/theme-runtime'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => vi.restoreAllMocks())

describe('theme preferences', () => {
  it('restores the saved preference in a fresh store', () => {
    const store = useThemeStore()
    store.setPreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    setActivePinia(createPinia())
    expect(useThemeStore().preference).toBe('dark')
  })

  it('falls back to system for invalid saved data', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(useThemeStore().preference).toBe('system')
  })

  it('still changes the session theme when browser storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('quota')
    })
    const store = useThemeStore()
    expect(store.preference).toBe('system')
    expect(store.storageAvailable).toBe(false)
    store.setPreference('dark')
    expect(store.resolvedTheme).toBe('dark')
    expect(store.storageAvailable).toBe(false)
  })

  it('follows system changes only in system mode and cleans up its listener', () => {
    const store = useThemeStore()
    const root = document.createElement('div')
    let onChange: ((event: MediaQueryListEvent) => void) | undefined
    const removeEventListener = vi.fn()
    const media = {
      matches: true,
      addEventListener: vi.fn((_type, callback) => {
        onChange = callback
      }),
      removeEventListener,
    }
    const stop = connectTheme(store, root, media)
    expect(root.dataset.theme).toBe('dark')
    onChange?.({ matches: false } as MediaQueryListEvent)
    expect(root.dataset.theme).toBe('light')
    store.setPreference('light')
    onChange?.({ matches: true } as MediaQueryListEvent)
    expect(root.dataset.theme).toBe('light')
    store.setPreference('system')
    expect(root.dataset.theme).toBe('dark')
    stop()
    expect(removeEventListener).toHaveBeenCalledWith('change', onChange)
  })
})

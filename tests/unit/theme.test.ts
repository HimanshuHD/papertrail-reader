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

  it('falls back to light for invalid saved data', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(useThemeStore().preference).toBe('light')
  })

  it('still changes the session theme when browser storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('quota')
    })
    const store = useThemeStore()
    expect(store.preference).toBe('light')
    expect(store.storageAvailable).toBe(false)
    store.setPreference('dark')
    expect(store.resolvedTheme).toBe('dark')
    expect(store.storageAvailable).toBe(false)
  })

  it('migrates a legacy system preference to light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    expect(useThemeStore().preference).toBe('light')
  })

  it('applies explicit appearance and stops watching on cleanup', () => {
    const store = useThemeStore()
    const root = document.createElement('div')
    const stop = connectTheme(store, root)
    expect(root.dataset.theme).toBe('light')
    store.setPreference('dark')
    expect(root.dataset.theme).toBe('dark')
    stop()
    store.setPreference('light')
    expect(root.dataset.theme).toBe('dark')
  })
})

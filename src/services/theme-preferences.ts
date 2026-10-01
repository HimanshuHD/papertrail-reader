export type ThemePreference = 'system' | 'light' | 'dark'
export const THEME_STORAGE_KEY = 'papertrail.theme.v1'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readThemePreference(): { preference: ThemePreference; storageAvailable: boolean } {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return { preference: isThemePreference(saved) ? saved : 'system', storageAvailable: true }
  } catch {
    return { preference: 'system', storageAvailable: false }
  }
}

export function saveThemePreference(preference: ThemePreference): boolean {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

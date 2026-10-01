export type ThemePreference = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'papertrail.theme.v1'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark'
}

export function readThemePreference(): { preference: ThemePreference; storageAvailable: boolean } {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return { preference: isThemePreference(saved) ? saved : 'light', storageAvailable: true }
  } catch {
    return { preference: 'light', storageAvailable: false }
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

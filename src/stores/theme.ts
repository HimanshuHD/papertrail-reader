import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { readThemePreference, saveThemePreference } from '../services/theme-preferences'
import type { ThemePreference } from '../services/theme-preferences'

export const useThemeStore = defineStore('theme', () => {
  const saved = readThemePreference()
  const preference = ref<ThemePreference>(saved.preference)
  const storageAvailable = ref(saved.storageAvailable)
  const systemDark = ref(false)
  const resolvedTheme = computed(() =>
    preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value,
  )

  function setPreference(value: ThemePreference) {
    preference.value = value
    storageAvailable.value = saveThemePreference(value)
  }

  return { preference, storageAvailable, systemDark, resolvedTheme, setPreference }
})

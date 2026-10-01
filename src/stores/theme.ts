import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { readThemePreference, saveThemePreference } from '../services/theme-preferences'
import type { ThemePreference } from '../services/theme-preferences'

export const useThemeStore = defineStore('theme', () => {
  const saved = readThemePreference()
  const preference = ref<ThemePreference>(saved.preference)
  const storageAvailable = ref(saved.storageAvailable)
  const resolvedTheme = computed(() => preference.value)

  function setPreference(value: ThemePreference) {
    preference.value = value
    storageAvailable.value = saveThemePreference(value)
  }

  return { preference, storageAvailable, resolvedTheme, setPreference }
})

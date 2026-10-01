import { watch } from 'vue'
import type { useThemeStore } from '../stores/theme'

export function connectTheme(
  store: ReturnType<typeof useThemeStore>,
  root: HTMLElement = document.documentElement,
) {
  return watch(
    () => store.resolvedTheme,
    (theme) => {
      root.dataset.theme = theme
    },
    { immediate: true, flush: 'sync' },
  )
}

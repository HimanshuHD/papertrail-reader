import { watch } from 'vue'
import type { useThemeStore } from '../stores/theme'

type ThemeMedia = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>

export function connectTheme(
  store: ReturnType<typeof useThemeStore>,
  root: HTMLElement = document.documentElement,
  media: ThemeMedia | undefined = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined,
) {
  store.systemDark = media?.matches ?? false
  const onSystemChange = (event: MediaQueryListEvent) => {
    store.systemDark = event.matches
  }
  media?.addEventListener('change', onSystemChange)
  const stop = watch(
    () => store.resolvedTheme,
    (theme) => {
      root.dataset.theme = theme
    },
    { immediate: true, flush: 'sync' },
  )
  return () => {
    stop()
    media?.removeEventListener('change', onSystemChange)
  }
}

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createWebHashHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'
import { createAppRouter } from '../../src/router'
import { useThemeStore } from '../../src/stores/theme'
import { connectTheme } from '../../src/services/theme-runtime'
import { THEME_STORAGE_KEY } from '../../src/services/theme-preferences'

describe('application routing and appearance', () => {
  it('renders the home view and persists changes from the accessible toggle', async () => {
    localStorage.clear()
    const pinia = createPinia()
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')
    await router.isReady()
    const root = document.createElement('div')
    const stop = connectTheme(useThemeStore(pinia), root)
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    expect(wrapper.get('h1').text()).toBe('PaperTrail')
    expect(wrapper.get('button[aria-label="Dark mode"]').attributes('aria-pressed')).toBe('false')
    await wrapper.get('button[aria-label="Dark mode"]').trigger('click')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    expect(root.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    await wrapper.get('button[aria-label="Dark mode"]').trigger('click')
    expect(root.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    await router.push('/unknown')
    expect(router.currentRoute.value.name).toBe('home')
    wrapper.unmount()
    stop()
  })

  it('keeps hash URLs inside the production or PR base path', () => {
    for (const base of ['/papertrail-reader/', '/papertrail-reader/preview/pr-41/']) {
      const history = createWebHashHistory(base)
      expect(history.base).toBe(`${base}#`)
      const href = new URL(history.createHref('/'), `https://example.com${base}`)
      expect(href.pathname).toBe(base)
      expect(href.hash).toBe('#/')
      history.destroy()
    }
  })
})

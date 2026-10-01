import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'
import ReaderView from '../../src/views/ReaderView.vue'
import { createAppRouter } from '../../src/router'

async function mountApp(path = '/') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

describe('home and product shell', () => {
  it('retains home content and navigates from the card to the separate app and back', async () => {
    const { wrapper, router } = await mountApp()
    expect(wrapper.text()).toContain('The foundation is ready')
    const link = wrapper.get('section a[href="/app"]')
    expect(link.text()).toContain('Go to app')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reader')
    expect(wrapper.find('aside').exists()).toBe(true)
    await wrapper.get('a[aria-label="PaperTrail home"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    wrapper.unmount()
  })

  it('supports direct app entry and history navigation', async () => {
    const { wrapper, router } = await mountApp('/app')
    expect(wrapper.findComponent(ReaderView).exists()).toBe(true)
    await router.push('/')
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reader')
    wrapper.unmount()
  })

  it('collapses and restores the sidebar without losing selected sample metadata', async () => {
    const { wrapper } = await mountApp('/app')
    const epub = wrapper
      .findAll('nav button')
      .find((button) => button.text().includes('The next chapter'))!
    await epub.trigger('click')
    expect(epub.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('#reader-title').text()).toBe('The next chapter')
    expect(wrapper.text()).toContain('Font size')
    const toggle = wrapper.get('button[aria-controls="document-sidebar"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('aside').exists()).toBe(false)
    await toggle.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.get('#reader-title').text()).toBe('The next chapter')
    wrapper.unmount()
  })

  it('identifies demonstration content and prevents unavailable file/reader actions', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.text()).toContain('No folders or files have been accessed')
    expect(wrapper.text()).toContain('does not open a document')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.findAll('button:disabled')).toHaveLength(3)
    wrapper.unmount()
  })
})

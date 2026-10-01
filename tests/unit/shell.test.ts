import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'
import ShellStatus from '../../src/components/viewer/ShellStatus.vue'
import ReaderView from '../../src/views/ReaderView.vue'
import { createAppRouter } from '../../src/router'

async function mountApp(path = '/') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router] },
  })
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

  it('closes the library with Escape and restores focus to its toggle', async () => {
    const { wrapper } = await mountApp('/app')
    const documentButton = wrapper.get('nav button')
    ;(documentButton.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(documentButton.element)
    await documentButton.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    const toggle = wrapper.get('button[aria-controls="document-sidebar"]')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(document.activeElement).toBe(toggle.element)
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Sample library hidden.')
    wrapper.unmount()
  })

  it('announces sample selection changes without moving focus', async () => {
    const { wrapper } = await mountApp('/app')
    const epub = wrapper
      .findAll('nav button')
      .find((button) => button.text().includes('The next chapter'))!
    ;(epub.element as HTMLButtonElement).focus()
    await epub.trigger('click')
    expect(document.activeElement).toBe(epub.element)
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Selected sample: The next chapter.')
    wrapper.unmount()
  })

  it.each([
    ['empty', 'No documents selected', 'status'],
    ['loading', 'Preparing your library', 'status'],
    ['error', 'PaperTrail could not prepare the library', 'alert'],
    ['demo', 'Demonstration workspace', 'status'],
  ] as const)(
    'presents the %s shell state with an accessible announcement',
    (state, text, role) => {
      const wrapper = mount(ShellStatus, { props: { state } })
      expect(wrapper.get(`[role="${role}"]`).text()).toContain(text)
      wrapper.unmount()
    },
  )

  it('identifies demonstration content and prevents unavailable file/reader actions', async () => {
    const { wrapper } = await mountApp('/app')
    expect(wrapper.text()).toContain('No folders or files have been accessed')
    expect(wrapper.text()).toContain('does not open a document')
    expect(wrapper.text()).toContain('Demonstration workspace')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.findAll('button:disabled')).toHaveLength(3)
    wrapper.unmount()
  })
})

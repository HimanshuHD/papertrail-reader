import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BuildFooter from '../../src/components/BuildFooter.vue'

const sha = '1234567890abcdef1234567890abcdef12345678'
afterEach(() => vi.unstubAllEnvs())

describe('deployment footer', () => {
  it('identifies a preview PR and links the displayed SHA to the full commit', () => {
    vi.stubEnv('VITE_BUILD_SHA', sha)
    vi.stubEnv('VITE_PR_NUMBER', '38')
    const wrapper = mount(BuildFooter)
    expect(wrapper.text()).toContain('Preview')
    expect(wrapper.text()).toContain('PR #38')
    expect(wrapper.text()).toContain('1234567')
    expect(wrapper.get('a[href$="/pull/38"]').text()).toBe('PR #38')
    expect(wrapper.get(`a[href$="/commit/${sha}"]`).attributes('title')).toBe(sha)
    wrapper.unmount()
  })

  it('labels main builds as production without claiming a PR', () => {
    vi.stubEnv('VITE_BUILD_SHA', sha)
    vi.stubEnv('VITE_PR_NUMBER', '')
    const wrapper = mount(BuildFooter)
    expect(wrapper.text()).toContain('Production · main')
    expect(wrapper.text()).not.toContain('PR #')
    wrapper.unmount()
  })

  it('shows an honest development fallback when metadata is absent', () => {
    vi.stubEnv('VITE_BUILD_SHA', '')
    vi.stubEnv('VITE_PR_NUMBER', '')
    const wrapper = mount(BuildFooter)
    expect(wrapper.text()).toBe('Development · SHA unavailable')
    expect(wrapper.find('a').exists()).toBe(false)
    wrapper.unmount()
  })
})

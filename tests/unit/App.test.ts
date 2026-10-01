import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'

describe('foundation screen', () => {
  it('names its main and status landmarks with visible headings', () => {
    const wrapper = mount(App)
    for (const selector of ['main', 'section']) {
      const region = wrapper.get(selector)
      const label = region.attributes('aria-labelledby')
      expect(label).toBeTruthy()
      expect(wrapper.get(`#${label}`).text()).not.toBe('')
    }
    wrapper.unmount()
  })

  it('explains supported plans and unavailable file access before selection exists', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('PDF and EPUB')
    expect(wrapper.text()).toContain('does not scan or open files yet')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

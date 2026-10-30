import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, expect, it } from 'vitest'
import ReaderNotice from '../../src/components/viewer/ReaderNotice.vue'
const sections = [
  {
    title: 'Illustration availability',
    label: 'Illustration notice',
    message: 'Some illustrations are unavailable. You can continue reading or use Text-only view.',
    reasons: ['SVG illustration exceeds its limit.'],
  },
]
afterEach(() => document.body.replaceChildren())
it('opens details only on activation, keeps reasons, and restores keyboard focus on Escape/close', async () => {
  const wrapper = mount(ReaderNotice, { props: { sections }, attachTo: document.body })
  try {
    const button = wrapper.get('button')
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(wrapper.get('[role=status]').text()).toContain(sections[0]!.reasons[0])
    await button.trigger('mouseenter')
    expect(document.querySelectorAll('[role=tooltip]')).toHaveLength(1)
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(button.attributes('title')).toBeUndefined()
    await button.trigger('click')
    await nextTick()
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('[role=dialog]')?.textContent).toContain(sections[0]!.reasons[0])
    expect(document.querySelectorAll('[role=tooltip]')).toHaveLength(0)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close rendering information')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(document.activeElement).toBe(button.element)
    await button.trigger('click')
    ;(
      document.querySelector('[aria-label="Close rendering information"]') as HTMLButtonElement
    ).click()
    await nextTick()
    expect(document.activeElement).toBe(button.element)
    expect(wrapper.get('[role=status]').text()).toContain(sections[0]!.reasons[0])
  } finally {
    wrapper.unmount()
  }
})
it('closes stale details on warning/mode/tab changes and keeps IDs independent in split readers', async () => {
  const parent = mount(
    {
      components: { ReaderNotice },
      data: () => ({ firstSections: sections, secondSections: sections, secondActive: true }),
      template:
        '<ReaderNotice :sections="firstSections" /><ReaderNotice :sections="secondSections" :active="secondActive" />',
    },
    { attachTo: document.body },
  )
  const [first, second] = parent.findAllComponents(ReaderNotice)
  if (!first || !second) throw new Error('Both reader notices must be mounted.')
  try {
    await first.get('button').trigger('click')
    const firstId = first.get('button').attributes('aria-controls')
    await second.get('button').trigger('click')
    expect(second.get('button').attributes('aria-controls')).not.toBe(firstId)
    await parent.setData({
      firstSections: [
        { title: 'Font availability', label: 'Font notice', message: 'Fallback fonts are used.' },
      ],
    })
    expect(first.get('button').attributes('aria-expanded')).toBe('false')
    expect(first.text()).not.toContain('SVG illustration')
    await parent.setData({ secondActive: false })
    expect(second.find('button').exists()).toBe(false)
    expect(document.querySelector('[role=dialog]')).toBeNull()
    await parent.setData({ firstSections: [] })
    expect(first.find('button').exists()).toBe(false)
    expect(first.find('[role=status]').exists()).toBe(false)
  } finally {
    parent.unmount()
  }
})

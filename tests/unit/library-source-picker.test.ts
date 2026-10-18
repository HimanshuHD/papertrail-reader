import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LibrarySourcePicker from '../../src/components/library/LibrarySourcePicker.vue'

const props = { selectionSummary: '', refreshAction: null, refreshBusy: false }

describe('responsive library actions', () => {
  it('uses the same local file selection in the narrow vertical menu', async () => {
    const wrapper = mount(LibrarySourcePicker, { props: { ...props, compact: true } })
    expect(wrapper.find('[aria-label="Add local documents"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Hide library"]').exists()).toBe(true)
    await wrapper.get('[aria-label="Library actions"]').trigger('click')
    const choose = wrapper.findAll('[role="menuitem"]')[1]!
    const click = vi.spyOn(wrapper.get('input[accept]').element as HTMLInputElement, 'click')
    await choose.trigger('click')
    expect(click).toHaveBeenCalledOnce()
    const input = wrapper.get('input[accept]')
    const file = new File(['pdf'], 'local.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    expect(wrapper.emitted('selected')?.[0]?.[0]).toMatchObject({
      source: 'file-input',
      files: [file],
    })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps refresh and Forget available without allowing keyboard focus on disabled items', async () => {
    const wrapper = mount(LibrarySourcePicker, {
      attachTo: document.body,
      props: { ...props, compact: true, canForget: true },
    })
    const trigger = wrapper.get('[aria-label="Library actions"]')
    await trigger.trigger('click')
    await flushPromises()
    const items = wrapper.findAll('[role="menuitem"]')
    expect(items[2]!.attributes('disabled')).toBeDefined()
    ;(items[1]!.element as HTMLButtonElement).focus()
    await items[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[3]!.element)
    await items[3]!.trigger('click')
    expect(wrapper.emitted('forget')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger.element)
    await wrapper.setProps({ refreshAction: 'refresh-directory' })
    await trigger.trigger('click')
    await wrapper.findAll('[role="menuitem"]')[2]!.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    wrapper.unmount()
  })

  it('dismisses a menu and transfers focus to the new trigger when its layout changes', async () => {
    const wrapper = mount(LibrarySourcePicker, { attachTo: document.body, props })
    await wrapper.get('[aria-label="Add local documents"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ compact: true })
    await flushPromises()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Library actions"]').element)
    wrapper.unmount()
  })
})

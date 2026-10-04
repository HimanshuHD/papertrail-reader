import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import EpubReaderWorkspace from '../../src/components/viewer/EpubReaderWorkspace.vue'
import type { EpubSession } from '../../src/features/epub/epub-session'

const mocked = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../src/features/epub/epub-session', () => ({ openEpubSession: mocked.open }))

it('opens formatted by default, keeps side navigation outside the header and retains position across modes', async () => {
  const position = { node: 'pt-3', offset: -10, ratio: 0.4 }
  const sessions: EpubSession[] = Array.from({ length: 3 }, () => ({
    title: 'Book',
    chapters: [
      { label: 'One', href: 'one' },
      { label: 'Two', href: 'two' },
    ],
    display: vi.fn(async () => {}),
    position: () => position,
    appearance: vi.fn(),
    destroy: vi.fn(),
  }))
  for (const session of sessions) mocked.open.mockResolvedValueOnce(session)
  const book = (name: string) => ({
    id: name,
    name,
    format: 'EPUB' as const,
    relativePath: name,
    parentPath: '',
    source: 'file-input' as const,
    file: new File([], name),
  })
  const wrapper = mount(EpubReaderWorkspace, {
    props: { document: book('one.epub') },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  const checkbox = wrapper.get('input[type="checkbox"]')
  expect(checkbox.element).toHaveProperty('checked', false)
  expect(mocked.open.mock.calls[0]![3]).toMatchObject({ textOnly: false, chapter: 0 })
  expect(wrapper.get('label[for="epub-chapter"]').text()).toBe('Chapters')
  expect(wrapper.find('header button').exists()).toBe(false)
  expect(
    wrapper.get('.epub-stage button[aria-label="Previous chapter"]').attributes('disabled'),
  ).toBeDefined()
  await wrapper.get('.epub-stage button[aria-label="Next chapter"]').trigger('click')
  await flushPromises()
  expect(sessions[0]!.display).toHaveBeenCalledWith(1)
  await checkbox.setValue(true)
  await flushPromises()
  expect(mocked.open.mock.calls[1]![3]).toEqual({ textOnly: true, chapter: 1, position })
  expect(sessions[0]!.destroy).toHaveBeenCalledOnce()
  expect(wrapper.get('select').element).toHaveProperty('value', '1')
  await wrapper.setProps({ document: book('other.epub') })
  await flushPromises()
  expect(checkbox.element).toHaveProperty('checked', false)
  expect(mocked.open.mock.calls[2]![3]).toMatchObject({ textOnly: false, chapter: 0 })
  wrapper.unmount()
  expect(sessions[2]!.destroy).toHaveBeenCalledOnce()
})

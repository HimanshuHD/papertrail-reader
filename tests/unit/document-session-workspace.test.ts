import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import Workspace from '../../src/components/viewer/DocumentSessionWorkspace.vue'
import type { DiscoveredDocument } from '../../src/features/library/discovery'
import type { SessionState } from '../../src/features/reader/document-sessions'

vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async (file: File) => `test:${file.name}`),
}))

const observations = vi.hoisted(() => ({
  live: 0,
  maximum: 0,
  mounted: [] as string[],
  disposed: [] as string[],
  states: [] as SessionState[],
  finish: undefined as undefined | (() => void),
  hold: false,
}))
vi.mock('../../src/components/viewer/PdfReaderWorkspace.vue', () => ({
  default: defineComponent({
    props: {
      document: { type: Object as PropType<DiscoveredDocument>, required: true },
      initialState: { type: Object as PropType<SessionState>, required: true },
    },
    emits: ['status', 'identity', 'phaseChange', 'recentReady', 'utilityChange'],
    setup(props, { expose, emit }) {
      const id = props.document.id
      ++observations.live
      observations.maximum = Math.max(observations.maximum, observations.live)
      observations.mounted.push(id)
      observations.states.push(props.initialState)
      let disposed: Promise<void> | undefined
      expose({
        capture: () => ({
          panel: 'search',
          query: id,
          pdf: { page: 2, view: { fitMode: 'width', zoom: 1 } },
        }),
        dispose: () => {
          if (!disposed) {
            observations.disposed.push(id)
            --observations.live
            disposed = observations.hold
              ? new Promise<void>((resolve) => {
                  observations.finish = resolve
                })
              : Promise.resolve()
            // Simulate a stale callback during disposal; host must reject it.
            emit('status', `stale ${id}`)
            emit('identity', `stale ${id}`)
          }
          return disposed
        },
      })
      return () => h('div', { 'data-reader': id })
    },
  }),
}))
vi.mock('../../src/components/viewer/EpubReaderWorkspace.vue', async () => {
  const pdf = await import('../../src/components/viewer/PdfReaderWorkspace.vue')
  return { default: pdf.default }
})
function doc(id: string, format: 'PDF' | 'EPUB' = 'PDF'): DiscoveredDocument {
  return {
    id,
    format,
    file: new File([id], id),
    name: id,
    relativePath: id,
    parentPath: '',
    source: 'file-input',
  }
}
afterEach(() => {
  observations.live = 0
  observations.maximum = 0
  observations.mounted.length = 0
  observations.disposed.length = 0
  observations.states.length = 0
  observations.hold = false
  observations.finish = undefined
})
it('mounts only after cleanup and restores owning session state across format changes', async () => {
  const a = doc('a'),
    b = doc('b', 'EPUB')
  const onActiveChange = vi.fn()
  const wrapper = mount(Workspace, { props: { document: a, onActiveChange } })
  await flushPromises()
  observations.hold = true
  await wrapper.setProps({ document: b })
  await flushPromises()
  expect(observations.mounted).toEqual(['a'])
  expect(wrapper.find('[data-reader]').exists()).toBe(false)
  expect(
    wrapper
      .emitted('status')
      ?.flat()
      .some((message) => String(message).startsWith('stale')),
  ).toBe(false)
  expect(wrapper.emitted('identity')).toBeUndefined()
  observations.hold = false
  observations.finish!()
  await flushPromises()
  expect(observations.mounted).toEqual(['a', 'b'])
  await wrapper.setProps({ document: a })
  await flushPromises()
  expect(observations.states[2]?.query).toBe('a')
  expect(observations.states[1]?.query).toBe('')
  expect(observations.maximum).toBe(1)
  const changes = onActiveChange.mock.calls.length
  expect(changes).toBeGreaterThan(0)
  wrapper.unmount()
  await flushPromises()
  expect(onActiveChange).toHaveBeenCalledTimes(changes)
  expect(observations.live).toBe(0)
})
it('rapid replacement and clearing the source never mount a queued reader', async () => {
  const wrapper = mount(Workspace, { props: { document: doc('a') } })
  await flushPromises()
  observations.hold = true
  await wrapper.setProps({ document: doc('b') })
  await wrapper.setProps({ document: doc('c', 'EPUB') })
  await wrapper.setProps({ document: null })
  observations.hold = false
  observations.finish!()
  await flushPromises()
  expect(observations.mounted).toEqual(['a'])
  expect(observations.disposed).toEqual(['a'])
  wrapper.unmount()
})

it.each(['PDF', 'EPUB'] as const)(
  'restores %s context from the same prop update that activates its document',
  async (format) => {
    const wrapper = mount(Workspace, { props: { document: null } })
    await flushPromises()
    await wrapper.setProps({
      document: doc('restored', format),
      initialPanel: 'contents',
      initialSearchQuery: 'saved query',
    })
    await flushPromises()
    expect(observations.states[0]).toMatchObject({ panel: 'contents', query: 'saved query' })
    wrapper.unmount()
  },
)

it('a late content check cannot activate a document after a newer request', async () => {
  const { fingerprintDocument } = await import('../../src/services/document-identity')
  let finish!: (fingerprint: string) => void
  vi.mocked(fingerprintDocument).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const wrapper = mount(Workspace, { props: { document: doc('slow') } })
  await wrapper.setProps({ document: doc('newer') })
  await flushPromises()
  expect(observations.mounted).toEqual(['newer'])
  finish('slow-fingerprint')
  await flushPromises()
  expect(observations.mounted).toEqual(['newer'])
  wrapper.unmount()
})

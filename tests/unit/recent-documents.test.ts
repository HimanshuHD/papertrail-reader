import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import {
  filterLibrary,
  normalizeRecents,
  matchRecent,
  type RecentDocument,
  type RecentStorage,
} from '../../src/services/recent-documents'
import { useRecentDocuments } from '../../src/composables/useRecentDocuments'
import LibrarySidebar from '../../src/components/library/LibrarySidebar.vue'
import type { DiscoveredDocument } from '../../src/features/library/discovery'
vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async (file: File) =>
    file.name === 'renamed.pdf' ? 'digest' : 'different',
  ),
}))
const entry: RecentDocument = {
  id: 'stable',
  fingerprint: 'digest',
  name: 'old.pdf',
  relativePath: 'old.pdf',
  openedAt: 1,
}
const doc = (name: string, title?: string): DiscoveredDocument => ({
  id: name,
  name,
  title,
  relativePath: `Folder/${name}`,
  parentPath: 'Folder',
  format: 'PDF',
  source: 'file-input',
  file: new File(['pdf'], name),
})
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()))
it('bounds history, ignores malformed records and keeps latest content identity', () => {
  const values = Array.from({ length: 25 }, (_, n) => ({
    ...entry,
    id: String(n),
    fingerprint: String(n),
    openedAt: n + 1,
  }))
  const result = normalizeRecents([
    null,
    { ...entry, openedAt: NaN },
    ...values,
    { ...values[24], id: 'latest', openedAt: 100 },
  ])
  expect(result).toHaveLength(20)
  expect(result[0]?.id).toBe('latest')
  expect(normalizeRecents([{ ...entry, title: { bad: true } }])).toEqual([])
})
it('filters by literal Unicode normalized name, title and path with all query terms', () => {
  const documents = [doc('guide.pdf', 'Café handbook'), doc('other.pdf')]
  expect(filterLibrary(documents, 'cafe\u0301 FOLDER')).toEqual([documents[0]])
  expect(filterLibrary(documents, '[')).toEqual([])
  expect(filterLibrary(documents, '   ')).toEqual(documents)
})
it('verifies bytes rather than paths and recovers changed or missing files', async () => {
  expect(
    await matchRecent(entry, [doc('old.pdf'), doc('renamed.pdf')], new AbortController().signal),
  ).toEqual(doc('renamed.pdf'))
  expect(await matchRecent(entry, [doc('old.pdf')], new AbortController().signal)).toBeNull()
  const controller = new AbortController()
  controller.abort()
  await expect(matchRecent(entry, [doc('renamed.pdf')], controller.signal)).rejects.toThrow()
})
it('serializes history operations and retains existing entries on storage failure', async () => {
  const storage: RecentStorage = {
    load: vi.fn(async () => [entry]),
    remember: vi.fn(async () => {
      throw Error('quota')
    }),
    remove: vi.fn(async () => []),
  }
  let state!: ReturnType<typeof useRecentDocuments>
  wrappers.push(
    mount({
      setup() {
        state = useRecentDocuments(storage)
        return () => null
      },
    }),
  )
  await flushPromises()
  expect(state.entries.value).toEqual([entry])
  await state.remember(entry)
  expect(state.notice.value).toContain('continue reading')
  expect(state.entries.value).toEqual([entry])
  await state.remove()
  expect(state.entries.value).toEqual([])
})
it('does not apply load results after unmount', async () => {
  let finish!: (value: RecentDocument[]) => void
  const storage: RecentStorage = {
    load: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    remember: vi.fn(),
    remove: vi.fn(),
  }
  let state!: ReturnType<typeof useRecentDocuments>
  const wrapper = mount({
    setup() {
      state = useRecentDocuments(storage)
      return () => null
    },
  })
  await flushPromises()
  wrapper.unmount()
  finish([entry])
  await flushPromises()
  expect(state.entries.value).toEqual([])
})
it('distinguishes library filtering, exposes recent recovery and emits independent history removal', async () => {
  const wrapper = mount(LibrarySidebar, {
    props: {
      libraryDocuments: [doc('guide.pdf', 'Guide'), doc('other.pdf')],
      selectedLibraryDocumentId: null,
      libraryLabel: 'Files',
      showLibraryResults: true,
      refreshAction: null,
      selectionSummary: '',
      discoverySummary: '',
      discoveryBusy: false,
      discoveryProblemCount: 0,
      recentDocuments: [entry],
      recentMessage: 'Reselect source',
    },
  })
  wrappers.push(wrapper)
  await wrapper.get('#library-filter').setValue('guide')
  expect(wrapper.text()).toContain('1 matching documents')
  expect(wrapper.find('#library-filter').attributes('placeholder')).toBe('Search documents...')
  expect(wrapper.text()).not.toContain('Search inside a PDF')
  expect(wrapper.text()).not.toContain('PDFs you open will appear here.')
  await wrapper.get('button[aria-label="Remove recent PDF old.pdf"]').trigger('click')
  expect(wrapper.emitted('removeRecent')).toEqual([['stable']])
  expect(wrapper.text()).toContain('Reselect source')
})

it('collapses recent entries by keyboard-accessible disclosure while preserving its count', async () => {
  const wrapper = mount(LibrarySidebar, {
    attachTo: document.body,
    props: {
      libraryDocuments: [],
      selectedLibraryDocumentId: null,
      libraryLabel: 'Files',
      showLibraryResults: false,
      refreshAction: null,
      selectionSummary: '',
      discoverySummary: '',
      discoveryBusy: false,
      discoveryProblemCount: 0,
      recentDocuments: [entry],
    },
  })
  wrappers.push(wrapper)
  const toggle = wrapper.get('#recent-title')
  expect(toggle.attributes('aria-expanded')).toBe('true')
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('false')
  expect(wrapper.get('#recent-documents').isVisible()).toBe(false)
  expect(toggle.text()).toBe('Recent1')
  await toggle.trigger('click')
  expect(wrapper.get('#recent-documents').isVisible()).toBe(true)
  expect(wrapper.get('#library-filter').attributes('aria-label')).toBe('Search library')
})

import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import {
  bookmarkName,
  normalizeBookmarks,
  type BookmarkStorage,
  type PdfBookmark,
} from '../../src/services/pdf-bookmarks'
import { usePdfBookmarks } from '../../src/composables/usePdfBookmarks'
import PdfBookmarksPanel from '../../src/components/viewer/PdfBookmarksPanel.vue'

const anchor = { page: 3, x: 0.5, y: 0.4 }
const mark: PdfBookmark = { id: 'mark', name: 'Remember this', anchor, createdAt: 1 }
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
function repository(): BookmarkStorage {
  return {
    load: vi.fn(async () => [mark]),
    add: vi.fn(async () => [mark, { ...mark, id: 'new' }]),
    rename: vi.fn(async (_id, _mark, name) => [{ ...mark, name }]),
    remove: vi.fn(async () => []),
  }
}
function setup(storage = repository()) {
  const id = ref<string | null>('A')
  let bookmarks!: ReturnType<typeof usePdfBookmarks>
  wrappers.push(
    mount({
      setup() {
        bookmarks = usePdfBookmarks(id, storage)
        return () => null
      },
    }),
  )
  return { id, bookmarks, storage }
}

it('validates names and discards corrupt/duplicate metadata without interpolating HTML', () => {
  expect(bookmarkName('  A chapter  ')).toBe('A chapter')
  expect(() => bookmarkName(' ')).toThrow()
  expect(() => bookmarkName('a'.repeat(121))).toThrow()
  expect(
    normalizeBookmarks([
      mark,
      mark,
      null,
      { ...mark, id: 'bad', anchor: { ...anchor, page: 0 } },
      { ...mark, id: 'html', name: '<img>' },
    ]),
  ).toEqual([mark, { ...mark, id: 'html', name: '<img>' }])
})
it('uses only the resolved identity and ignores stale loads after a document switch', async () => {
  const storage = repository()
  let finish!: (value: PdfBookmark[]) => void
  vi.mocked(storage.load).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { id, bookmarks } = setup(storage)
  id.value = 'B'
  await flushPromises()
  finish([{ ...mark, name: 'Old document' }])
  await flushPromises()
  expect(bookmarks.bookmarks.value).toEqual([mark])
  await bookmarks.add('B only', anchor)
  expect(storage.add).toHaveBeenCalledWith('B', 'B only', anchor)
  id.value = null
  expect(bookmarks.bookmarks.value).toEqual([])
  expect(await bookmarks.add('No identity', anchor)).toBe(false)
})
it('rejects duplicate pending actions and hides stale mutation results from the next document', async () => {
  const { id, bookmarks, storage } = setup()
  await flushPromises()
  let finish!: (value: PdfBookmark[]) => void
  vi.mocked(storage.add).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const add = bookmarks.add('New', anchor)
  await flushPromises()
  expect(await bookmarks.add('Double click', anchor)).toBe(false)
  id.value = 'B'
  await flushPromises()
  finish([{ ...mark, name: 'A mutation' }])
  expect(await add).toBe(false)
  expect(bookmarks.bookmarks.value).toEqual([mark])
  expect(bookmarks.notice.value).toBe('')
})
it('keeps the list and drafts recoverable on storage errors and retries failed loads', async () => {
  const storage = repository()
  vi.mocked(storage.load).mockRejectedValueOnce(new Error('quota'))
  const { bookmarks } = setup(storage)
  await flushPromises()
  expect(bookmarks.available.value).toBe(false)
  expect(bookmarks.notice.value).toContain('could not be loaded')
  await bookmarks.reload()
  vi.mocked(storage.rename).mockRejectedValueOnce(new Error('cleared'))
  expect(await bookmarks.rename(mark.id, 'Renamed')).toBe(false)
  expect(bookmarks.bookmarks.value).toEqual([mark])
  expect(bookmarks.notice.value).toContain('could not be saved')
  expect(await bookmarks.rename(mark.id, 'Renamed')).toBe(true)
  expect(bookmarks.bookmarks.value[0]?.name).toBe('Renamed')
  expect(await bookmarks.remove(mark.id)).toBe(true)
  expect(bookmarks.bookmarks.value).toEqual([])
})
it('does not publish async bookmark results after unmount', async () => {
  const storage = repository()
  let finish!: (value: PdfBookmark[]) => void
  vi.mocked(storage.load).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { bookmarks } = setup(storage)
  wrappers.pop()!.unmount()
  finish([mark])
  await flushPromises()
  expect(bookmarks.bookmarks.value).toEqual([])
})
it('preserves a failed add draft, offers inline rename and renders bookmark names as text', async () => {
  const add = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const rename = vi.fn(async () => true)
  const wrapper = mount(PdfBookmarksPanel, {
    attachTo: document.body,
    props: {
      bookmarks: [{ ...mark, name: '<img src=x>' }],
      available: true,
      busy: false,
      loading: false,
      notice: '',
      currentPage: 3,
      totalPages: 4,
      add,
      rename,
      remove: vi.fn(async () => true),
    },
  })
  wrappers.push(wrapper)
  await wrapper.get('#pdf-bookmark-name').setValue('My draft')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  expect(wrapper.get<HTMLInputElement>('#pdf-bookmark-name').element.value).toBe('My draft')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  expect(wrapper.get<HTMLInputElement>('#pdf-bookmark-name').element.value).toBe('')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.get('button[aria-label="Rename bookmark <img src=x>"]').trigger('click')
  await wrapper.get('input[id^="rename-"]').setValue('New name')
  await wrapper.findAll('form')[1]!.trigger('submit')
  await flushPromises()
  expect(rename).toHaveBeenCalledWith(mark.id, 'New name')
  expect(document.activeElement).toBe(wrapper.get('#pdf-bookmark-name').element)
})
it('disables bookmark controls for unavailable identity and out-of-range pages', async () => {
  const wrapper = mount(PdfBookmarksPanel, {
    props: {
      bookmarks: [mark],
      available: false,
      busy: false,
      loading: false,
      notice: '',
      currentPage: 1,
      totalPages: 2,
      add: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
    },
  })
  wrappers.push(wrapper)
  expect(
    wrapper.get('button[aria-label="Go to bookmark Remember this"]').attributes(),
  ).toHaveProperty('disabled')
  expect(wrapper.text()).toContain('saved document identity')
  await wrapper.setProps({ available: true })
  expect(
    wrapper.get('button[aria-label="Go to bookmark Remember this"]').attributes(),
  ).toHaveProperty('disabled')
})

import { describe, expect, it, vi } from 'vitest'
import { DocumentSessions, type SessionState } from '../../src/features/reader/document-sessions'
import type { DiscoveredDocument } from '../../src/features/library/discovery'

function document(id: string, format: 'PDF' | 'EPUB' = 'PDF'): DiscoveredDocument {
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
const state: SessionState = {
  pdf: { page: 3, view: { fitMode: 'custom', zoom: 1.5 } },
  panel: 'search',
  query: 'needle',
}
function runtime(value: SessionState = state) {
  return { capture: vi.fn(() => value), dispose: vi.fn(async () => {}) }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('retained document session ownership', () => {
  it('keeps exact PDF/EPUB readers and isolated state during warm switching', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const a = sessions.active!,
      reader = runtime()
    sessions.attach(a.session.id, a.generation, reader)
    sessions.update(a.session.id, a.generation, 'ready', 'a-hash')
    await sessions.open(document('b', 'EPUB'))
    const b = sessions.active!
    expect(sessions.retained.size).toBe(2)
    expect(sessions.owns(a.session.id, a.generation)).toBe(false)
    expect(sessions.retainedOwns(a.session.id, a.generation)).toBe(true)
    expect(reader.dispose).not.toHaveBeenCalled()
    expect(a.session.state).toEqual(state)
    await sessions.activate(a.session.id)
    expect(sessions.active).toBe(a)
    expect(b.session.state).toEqual({ panel: null, query: '' })
    await sessions.reset()
    await Promise.resolve()
    expect(reader.dispose).toHaveBeenCalledTimes(1)
  })

  it('expires after five inactive minutes, refreshes the deadline, and never expires the active reader', async () => {
    vi.useFakeTimers()
    try {
      const sessions = new DocumentSessions()
      await sessions.open(document('a'))
      const a = sessions.active!,
        reader = runtime()
      sessions.attach(a.session.id, a.generation, reader)
      await sessions.open(document('b'))
      const b = sessions.active!
      await vi.advanceTimersByTimeAsync(299999)
      expect(sessions.retained.has(a.session.id)).toBe(true)
      await sessions.activate(a.session.id)
      await vi.advanceTimersByTimeAsync(300001)
      expect(sessions.active).toBe(a)
      expect(sessions.retained.has(b.session.id)).toBe(false)
      await sessions.activate(b.session.id)
      await vi.advanceTimersByTimeAsync(299999)
      expect(reader.dispose).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(reader.dispose).toHaveBeenCalledTimes(1)
      expect(a.session.phase).toBe('suspended')
      await sessions.activate(a.session.id)
      expect(sessions.active!.generation).not.toBe(a.generation)
      expect(sessions.active!.session.state).toEqual(state)
      expect(sessions.update(a.session.id, a.generation, 'error')).toBe(false)
      await sessions.reset()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['rejected', 'unfinished'] as const)(
    'a %s cleanup cannot poison later opening, closing or clearing',
    async (kind) => {
      const sessions = new DocumentSessions()
      await sessions.open(document('a'))
      const a = sessions.active!,
        reader = runtime(),
        wait = deferred()
      reader.dispose.mockImplementation(() =>
        kind === 'rejected' ? Promise.reject(new Error('cleanup failed')) : wait.promise,
      )
      sessions.attach(a.session.id, a.generation, reader)
      await sessions.open(document('b'))
      await sessions.close(a.session.id)
      await sessions.open(document('c'))
      expect(sessions.active?.document.id).toBe('c')
      await sessions.reset()
      await sessions.open(document('after-clear'))
      expect(sessions.active?.document.id).toBe('after-clear')
      wait.resolve()
      await sessions.reset()
    },
  )

  it('rapid activation and close never revive a closed reader; stale attachments are disposed', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const a = sessions.active!
    await sessions.open(document('b'))
    const b = sessions.active!
    await Promise.all([
      sessions.activate(a.session.id),
      sessions.close(a.session.id),
      sessions.activate(b.session.id),
    ])
    expect(sessions.active).toBe(b)
    expect(sessions.retained.has(a.session.id)).toBe(false)
    const stale = runtime()
    sessions.attach(a.session.id, a.generation, stale)
    await Promise.resolve()
    expect(stale.dispose).toHaveBeenCalledTimes(1)
    await sessions.disconnect(b.session.id)
    expect(b.session.phase).toBe('reconnect')
    await sessions.activate(b.session.id)
    expect(sessions.active).toBeNull()
    await sessions.reset()
  })

  it('captures immutable state and does not reuse a replaced file with the same library id', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const first = sessions.active!,
      value = structuredClone(state)
    sessions.attach(first.session.id, first.generation, runtime(value))
    await sessions.open(document('a'))
    value.query = 'mutated after suspension'
    expect(first.session.state.query).toBe('needle')
    expect(sessions.active!.session.id).not.toBe(first.session.id)
    await sessions.reset()
    expect(sessions.retained.size).toBe(0)
  })
})

it('deduplicates verified content across names without merging different content with identical names', async () => {
  const sessions = new DocumentSessions()
  const a = document('a')
  await sessions.open(a, undefined, 'hash-one')
  const first = sessions.active!
  const duplicate = { ...document('alias'), name: 'renamed.pdf' }
  await sessions.open(duplicate, undefined, 'hash-one')
  expect(sessions.active?.session.id).toBe(first.session.id)
  await sessions.open({ ...document('b'), name: a.name }, undefined, 'hash-two')
  expect(sessions.active?.session.id).not.toBe(first.session.id)
  expect([...sessions.sessions.values()].filter((s) => s.phase !== 'closed')).toHaveLength(2)
  await sessions.disconnect(first.session.id)
  await sessions.open(duplicate, undefined, 'hash-one')
  expect(sessions.active?.session.id).toBe(first.session.id)
  expect(sessions.active?.document.file).toBe(duplicate.file)
  await sessions.reset()
})
it('inactive close keeps the live runtime; active close chooses right, then left, then empty', async () => {
  const sessions = new DocumentSessions()
  const ids: string[] = []
  for (const id of ['a', 'b', 'c', 'd']) {
    await sessions.open(document(id))
    ids.push(sessions.active!.session.id)
  }
  await sessions.activate(ids[1]!)
  const live = sessions.active!
  const reader = runtime()
  sessions.attach(live.session.id, live.generation, reader)
  await sessions.close(ids[0]!)
  expect(sessions.active).toBe(live)
  expect(reader.dispose).not.toHaveBeenCalled()
  await sessions.close(ids[1]!)
  expect(sessions.active?.session.id).toBe(ids[2])
  await sessions.close(ids[3]!)
  await sessions.close(ids[2]!)
  expect(sessions.active).toBeNull()
  expect(sessions.selectedId).toBeNull()
  expect(reader.dispose).toHaveBeenCalledTimes(1)
  await sessions.open(document('reopened'))
  expect(sessions.active).not.toBeNull()
  await sessions.reset()
})

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

describe('single live document session ownership', () => {
  it('PDF→PDF and PDF↔EPUB keep separate identity, position, utility state and local access', async () => {
    const sessions = new DocumentSessions()
    const a = document('a'),
      b = document('b'),
      c = document('c', 'EPUB')
    await sessions.open(a)
    const first = sessions.active!
    sessions.attach(first.session.id, first.generation, runtime())
    sessions.update(first.session.id, first.generation, 'ready', 'document-fingerprint')
    await sessions.open(b)
    expect(first.session.phase).toBe('suspended')
    expect(sessions.active!.session.state).toEqual({ panel: null, query: '' })
    const second = sessions.active!
    sessions.attach(
      second.session.id,
      second.generation,
      runtime({ panel: 'bookmarks', query: 'other' }),
    )
    await sessions.open(c)
    const third = sessions.active!
    sessions.attach(
      third.session.id,
      third.generation,
      runtime({
        epub: {
          textOnly: true,
          typography: { fontSize: 20, lineSpacing: 1.8, readingWidth: 640 },
          location: {
            version: 1,
            chapter: 1,
            kind: 'text',
            mode: 'formatted',
            cfi: null,
            node: 'pt-1',
            character: 0,
            quote: 'example',
            offset: 0,
            ratio: 0.5,
            atEnd: false,
          },
        },
        panel: 'contents',
        query: '',
      }),
    )
    await sessions.open(a)
    expect(sessions.active!.session.id).toBe(first.session.id)
    expect(sessions.active!.session.state).toEqual(state)
    expect(first.session.id).not.toBe(first.session.fingerprint)
    expect(JSON.stringify([...sessions.sessions.values()])).not.toContain('"file"')
    expect(second.session.state.query).toBe('other')
    expect(third.session.state.epub?.textOnly).toBe(true)
    await sessions.reset()
  })

  it('cancels/disposes immediately but waits for old resources before activating; latest rapid switch wins', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const first = sessions.active!
    const wait = deferred()
    const old = runtime()
    old.dispose.mockReturnValue(wait.promise)
    sessions.attach(first.session.id, first.generation, old)
    const b = sessions.open(document('b'))
    const c = sessions.open(document('c', 'EPUB'))
    expect(old.dispose).toHaveBeenCalledTimes(1)
    expect(sessions.active).toBeNull()
    expect(sessions.update(first.session.id, first.generation, 'ready', 'stale')).toBe(false)
    wait.resolve()
    await Promise.all([b, c])
    expect(sessions.active!.document.id).toBe('c')
    expect(first.session.fingerprint).toBeNull()
    await sessions.reset()
  })

  it('close during loading cancels queued activation and never revives a closed session', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const first = sessions.active!
    const wait = deferred(),
      old = runtime()
    old.dispose.mockReturnValue(wait.promise)
    sessions.attach(first.session.id, first.generation, old)
    const opening = sessions.open(document('b'))
    const queued = [...sessions.sessions.values()].find((s) => s.sourceId === 'b')!
    const closing = sessions.close(queued.id)
    wait.resolve()
    await Promise.all([opening, closing])
    expect(sessions.active).toBeNull()
    expect(queued.phase).toBe('closed')
    await sessions.activate(queued.id)
    expect(sessions.active).toBeNull()
  })

  it('disposes stale runtime attachment and marks lost local access as reconnect', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const first = sessions.active!,
      old = runtime()
    sessions.attach(first.session.id, first.generation, old)
    await sessions.disconnect(first.session.id)
    expect(old.dispose).toHaveBeenCalledTimes(1)
    await sessions.activate(first.session.id)
    expect(first.session.phase).toBe('reconnect')
    expect(sessions.active).toBeNull()
    const late = runtime()
    sessions.attach(first.session.id, first.generation, late)
    expect(late.dispose).toHaveBeenCalledTimes(1)
  })

  it('captures immutable state and does not reuse a replaced file with the same library id', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document('a'))
    const first = sessions.active!,
      value = structuredClone(state)
    sessions.attach(first.session.id, first.generation, runtime(value))
    await sessions.open(document('a'))
    value.query = 'mutated after release'
    expect(first.session.state.query).toBe('needle')
    expect(sessions.active!.session.id).not.toBe(first.session.id)
    await sessions.reset()
    expect(sessions.sessions.size).toBe(0)
    expect(sessions.active).toBeNull()
  })
})

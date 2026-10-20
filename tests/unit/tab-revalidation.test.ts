import { expect, it, vi } from 'vitest'
import type { DiscoveredDocument } from '../../src/features/library/discovery'
import { sessionDocument, type WorkspaceTabs } from '../../src/features/reader/session-snapshot'
import { revalidateTabs } from '../../src/services/tab-revalidation'
const fingerprint = vi.hoisted(() => vi.fn(async (file: File) => file.name.split('.')[0]!))
vi.mock('../../src/services/document-identity', () => ({ fingerprintDocument: fingerprint }))
function document(name: string, relativePath = name): DiscoveredDocument {
  return {
    id: name,
    name,
    relativePath,
    parentPath: '',
    format: 'PDF',
    source: 'file-input',
    file: new File(['bytes'], name),
  }
}
function saved(): WorkspaceTabs {
  return {
    version: 1,
    activeId: 'reader-session-1',
    sessions: ['a', 'b'].map((name, i) => ({
      id: `reader-session-${i + 1}`,
      document: sessionDocument(document(`${name}.pdf`)),
      fingerprint: name,
      state: { panel: null, query: '' },
    })),
  }
}
it('verifies content instead of names and only searches renamed paths after explicit reselection', async () => {
  fingerprint.mockClear()
  const renamed = document('a.pdf', 'renamed.pdf')
  const changed = document('changed.pdf', 'b.pdf')
  expect(await revalidateTabs(saved(), [renamed, changed])).toEqual(new Map())
  expect(await revalidateTabs(saved(), [renamed, changed], undefined, true)).toEqual(
    new Map([['reader-session-1', renamed]]),
  )
  expect(fingerprint).toHaveBeenCalled()
})
it('isolates unreadable documents, reuses file identity checks and stops aborted work', async () => {
  fingerprint.mockClear()
  fingerprint.mockImplementation(async (file) => {
    if (file.name === 'bad.pdf') throw new Error('unreadable')
    return file.name.split('.')[0]!
  })
  const a = document('a.pdf'),
    bad = document('bad.pdf', 'b.pdf')
  const entries = saved()
  entries.sessions.push({ ...entries.sessions[0]!, id: 'reader-session-3' })
  expect((await revalidateTabs(entries, [a, bad])).size).toBe(2)
  expect(fingerprint.mock.calls.filter(([file]) => file === a.file)).toHaveLength(1)
  const controller = new AbortController()
  controller.abort()
  await expect(revalidateTabs(entries, [a], controller.signal)).rejects.toThrow()
})

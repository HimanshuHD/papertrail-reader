import { ReadingMetadataDatabase } from './reading-database'
import { annotationIdentity, type AnnotationIdentity } from '../features/annotations/selectors'

export interface ReadingStatistics {
  version: 1
  id: string
  generation: string
  activeMs: number
  visits: number
  lastPosition: number
  furthestPosition: number
  updatedAt: number
}
export interface StatisticsHandle {
  id: string
  generation: string
  sessionId: string
}
interface Checkpoint {
  version: 1
  id: string
  generation: string
  activeMs: number
}
function normalize(value: unknown): ReadingStatistics {
  const v = value as ReadingStatistics | undefined
  if (
    !v ||
    v.version !== 1 ||
    typeof v.id !== 'string' ||
    typeof v.generation !== 'string' ||
    !Number.isSafeInteger(v.activeMs) ||
    v.activeMs < 0 ||
    !Number.isSafeInteger(v.visits) ||
    v.visits < 0 ||
    !Number.isFinite(v.lastPosition) ||
    v.lastPosition < 0 ||
    v.lastPosition > 1 ||
    !Number.isFinite(v.furthestPosition) ||
    v.furthestPosition < v.lastPosition ||
    v.furthestPosition > 1 ||
    !Number.isSafeInteger(v.updatedAt) ||
    v.updatedAt < 0
  )
    throw new Error('Unsupported or damaged reading statistics were preserved.')
  return { ...v }
}
function empty(id: string): ReadingStatistics {
  return {
    version: 1,
    id,
    generation: crypto.randomUUID(),
    activeMs: 0,
    visits: 0,
    lastPosition: 0,
    furthestPosition: 0,
    updatedAt: 0,
  }
}
/** Separate metadata database; resetting insights never touches positions, notes or source files. */
export class ReadingStatisticsStorage {
  constructor(private readonly database = new ReadingMetadataDatabase('papertrail-statistics')) {}
  open(
    identity: AnnotationIdentity,
  ): Promise<{ handle: StatisticsHandle; summary: ReadingStatistics }> {
    if (!annotationIdentity(identity))
      return Promise.reject(new Error('Invalid statistics identity.'))
    const id = `statistics:${identity.format}:${identity.fingerprint}`
    return this.database.transaction((store, done) => {
      const request = store.get(id)
      request.onsuccess = () => {
        try {
          const summary = request.result === undefined ? empty(id) : normalize(request.result)
          if (summary.id !== id) {
            store.transaction.abort()
            return
          }
          if (request.result === undefined) store.add(summary)
          done({
            handle: { id, generation: summary.generation, sessionId: crypto.randomUUID() },
            summary,
          })
        } catch {
          store.transaction.abort()
        }
      }
    })
  }
  checkpoint(
    handle: StatisticsHandle,
    activeMs: number,
    position: number,
  ): Promise<ReadingStatistics> {
    if (
      !Number.isSafeInteger(activeMs) ||
      activeMs < 0 ||
      !Number.isFinite(position) ||
      position < 0 ||
      position > 1
    )
      return Promise.reject(new Error('Invalid reading checkpoint.'))
    return this.database.transaction((store, done) => {
      const request = store.get(handle.id)
      request.onsuccess = () => {
        try {
          const summary = normalize(request.result)
          if (summary.id !== handle.id || summary.generation !== handle.generation) {
            store.transaction.abort()
            return
          }
          const key = `session:${handle.id}:${handle.generation}:${handle.sessionId}`
          const previous = store.get(key)
          previous.onsuccess = () => {
            const saved = previous.result as Checkpoint | undefined
            if (
              saved &&
              (saved.version !== 1 ||
                saved.generation !== handle.generation ||
                !Number.isSafeInteger(saved.activeMs) ||
                saved.activeMs < 0)
            ) {
              store.transaction.abort()
              return
            }
            const delta = Math.max(0, activeMs - (saved?.activeMs ?? 0))
            const next: ReadingStatistics = {
              ...summary,
              activeMs: summary.activeMs + delta,
              visits: summary.visits + (!saved && activeMs > 0 ? 1 : 0),
              lastPosition: position,
              furthestPosition: Math.max(summary.furthestPosition, position),
              updatedAt: Date.now(),
            }
            if (!Number.isSafeInteger(next.activeMs) || !Number.isSafeInteger(next.visits)) {
              store.transaction.abort()
              return
            }
            // Zero-time navigation does not establish a reading visit.
            if (activeMs > 0)
              store.put({
                version: 1,
                id: key,
                generation: handle.generation,
                activeMs: Math.max(activeMs, saved?.activeMs ?? 0),
              })
            store.put(next)
            done(next)
          }
        } catch {
          store.transaction.abort()
        }
      }
    })
  }
  reset(
    handle: StatisticsHandle,
  ): Promise<{ handle: StatisticsHandle; summary: ReadingStatistics }> {
    return this.database.transaction((store, done) => {
      const request = store.get(handle.id)
      request.onsuccess = () => {
        try {
          const current = normalize(request.result)
          if (current.generation !== handle.generation) {
            store.transaction.abort()
            return
          }
          const summary = empty(handle.id)
          store.put(summary)
          const cursor = store.openCursor()
          cursor.onsuccess = () => {
            if (cursor.result) {
              if (String(cursor.result.key).startsWith(`session:${handle.id}:`))
                cursor.result.delete()
              cursor.result.continue()
            } else
              done({
                handle: {
                  id: handle.id,
                  generation: summary.generation,
                  sessionId: crypto.randomUUID(),
                },
                summary,
              })
          }
        } catch {
          store.transaction.abort()
        }
      }
    })
  }
}

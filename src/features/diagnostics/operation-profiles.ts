import type { Metric } from './recorder'
import type { InvestigationSnapshot } from './resource-investigation'
import { metricNames, durationStats, type Snapshot } from './presentation'

export const readerProfileNames = {
  'pdf.cold-open': 'PDF cold reader open',
  'pdf.restored-open': 'PDF saved-workspace reader restore',
  'pdf.expired-open': 'PDF reader recreation after expiry',
  'pdf.warm-activate': 'PDF warm selection dispatch',
  'epub.cold-open': 'EPUB cold reader open',
  'epub.restored-open': 'EPUB saved-workspace reader restore',
  'epub.expired-open': 'EPUB reader recreation after expiry',
  'epub.warm-activate': 'EPUB warm selection dispatch',
} as const
export type ReaderProfile = keyof typeof readerProfileNames
export type OperationProfile = Metric | ReaderProfile
export const profileNames: Record<OperationProfile, string> = {
  ...metricNames,
  ...readerProfileNames,
}
export function isReaderProfile(value: string): value is ReaderProfile {
  return Object.hasOwn(readerProfileNames, value)
}
export function profileDescription(profile: OperationProfile) {
  if (profile.endsWith('warm-activate'))
    return 'Synchronous selection dispatch for a retained ready reader. This does not measure browser paint or first-readable latency.'
  if (isReaderProfile(profile))
    return 'Reader instance creation through ready/error, including restoration. Cold means a new application reader instance, not cleared browser or OS caches. Saved-workspace restoration and five-minute expiry recreation use separate profiles.'
  if (profile.endsWith('open-readable'))
    return 'Aggregate open-to-readable metric. Use reader lifecycle profiles for distinct cold, saved-workspace and expiry expectations; avoid configuring overlapping rules unless intentional.'
  return 'Measured application operation; configure this workload separately from reader lifecycle operations. No accepted budget is supplied.'
}
export function profileTimings(snapshot: Snapshot, investigation?: InvestigationSnapshot) {
  return [
    ...snapshot.timings,
    ...(investigation?.timings ?? []).flatMap((row) =>
      isReaderProfile(row.operation)
        ? [
            {
              metric: row.operation,
              durationMs: row.durationMs,
              outcome: row.outcome,
              startedAtMs: row.queuedAtMs,
              endedAtMs: row.endedAtMs,
            },
          ]
        : [],
    ),
  ].sort((a, b) => (a.endedAtMs ?? 0) - (b.endedAtMs ?? 0))
}
export function readerProfileStats(investigation: InvestigationSnapshot) {
  return (Object.keys(readerProfileNames) as ReaderProfile[]).map((profile) => {
    // Reuse the established completed-only statistics and p95 minimum without mixing profiles.
    const rows = investigation.timings.filter((row) => row.operation === profile)
    const stats = durationStats(rows)
    return { ...stats, metric: profile, name: readerProfileNames[profile] }
  })
}

export function profileDefinitions() {
  return (Object.keys(profileNames) as OperationProfile[]).map((profile) => ({
    profile,
    name: profileNames[profile],
    units: 'milliseconds',
    boundary: profileDescription(profile),
  }))
}

import type { IndicatorEvent, IndicatorState, Finding } from './indicators'
import type { Timing } from './recorder'

export type TimelineFilter = 'all' | 'incidents' | 'transitions'
export interface Incident {
  id: string
  atMs: number
  endMs?: number
  lastSeenAtMs: number
  state: 'attention' | 'critical'
  status: 'Active' | 'Recovered' | 'Interrupted' | 'Changed'
  transitions: IndicatorEvent[]
  operations: Timing[]
  findings: Finding[]
  evidence: IndicatorEvent
  evaluations: number
  title: string
}
export type TimelineRow =
  | { kind: 'incident'; atMs: number; id: string; incident: Incident }
  | { kind: 'transition'; atMs: number; id: string; event: IndicatorEvent }
  | { kind: 'operation'; atMs: number; id: string; operation: Timing }
export const stateLabels: Record<IndicatorState, string> = {
  recording: 'Good · observed responsiveness',
  attention: 'Needs attention',
  critical: 'Critical',
  inactive: 'Evaluation paused',
  collecting: 'Collecting data',
  unavailable: 'Unavailable',
  stale: 'Stale readings',
}
export function timelineTime(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
export function isWarning(state: IndicatorState) {
  return state === 'attention' || state === 'critical'
}
function title(findings: Finding[]) {
  if (findings.length && findings.every((f) => f.id === 'frames'))
    return 'Reader responsiveness dropped'
  if (findings.length && findings.every((f) => f.id === 'long-tasks')) return 'Repeated long tasks'
  if (findings.length && findings.every((f) => f.id.startsWith('pending:')))
    return 'Work waiting beyond its target'
  return 'Performance targets exceeded'
}
/** Group only contiguous warning transitions; never merge across recovery, interruption or missing history. */
export function buildTimeline(history: IndicatorEvent[], timings: Timing[]) {
  const events = [...history].sort((a, b) => a.atMs - b.atMs)
  const rows: TimelineRow[] = []
  const incidents: Incident[] = []
  const identities = new Map<string, number>()
  let current: Incident | undefined
  for (const event of events) {
    const identity = `${event.atMs}:${event.state}`
    const duplicate = identities.get(identity) ?? 0
    identities.set(identity, duplicate + 1)
    const id = `${identity}:${duplicate}`
    if (isWarning(event.state)) {
      if (!current) {
        current = {
          id,
          atMs: event.atMs,
          lastSeenAtMs: event.lastSeenAtMs,
          state: event.state as 'attention' | 'critical',
          status: 'Active',
          transitions: [],
          operations: [],
          findings: [],
          evidence: event,
          evaluations: 0,
          title: '',
        }
        incidents.push(current)
        rows.push({ kind: 'incident', atMs: event.atMs, id, incident: current })
      }
      current.transitions.push(event)
      current.lastSeenAtMs = Math.max(current.lastSeenAtMs, event.lastSeenAtMs)
      current.evaluations += event.evaluations
      if (event.state === 'critical') current.state = 'critical'
      for (const finding of event.findings) {
        const index = current.findings.findIndex((f) => f.id === finding.id)
        if (index < 0) current.findings.push({ ...finding })
        else if ((finding.observedMs ?? 0) > (current.findings[index]!.observedMs ?? 0))
          current.findings[index] = { ...finding }
      }
      const peak = (item: IndicatorEvent) =>
        Math.max(0, ...item.findings.map((f) => f.observedMs ?? 0))
      if (
        (event.state === 'critical' && current.evidence.state !== 'critical') ||
        (event.state === current.evidence.state && peak(event) > peak(current.evidence))
      )
        current.evidence = event
      current.title = title(current.findings)
      // A retained closed warning can outlive its following transition in imported evidence.
      if (event.endedAtMs !== undefined && event.resolution !== 'changed') {
        current.endMs = event.endedAtMs
        current.status = event.resolution === 'recovered' ? 'Recovered' : 'Interrupted'
        current = undefined
      }
    } else if (current) {
      current.transitions.push(event)
      current.endMs = event.atMs
      current.status =
        event.state === 'recording'
          ? 'Recovered'
          : event.state === 'collecting'
            ? 'Changed'
            : 'Interrupted'
      current = undefined
    } else {
      // Recovery belongs inside the immediately preceding closed incident as well.
      const previous = rows.at(-1)
      if (previous?.kind === 'incident' && previous.incident.endMs === event.atMs)
        previous.incident.transitions.push(event)
      else rows.push({ kind: 'transition', atMs: event.atMs, id, event })
    }
  }
  const positioned = timings.filter(
    (t) => t.endedAtMs !== undefined && Number.isFinite(t.endedAtMs),
  )
  positioned.forEach((operation, index) => {
    const atMs = operation.endedAtMs!
    const owner = incidents.find(
      (incident) => atMs >= incident.atMs && atMs <= (incident.endMs ?? Infinity),
    )
    if (owner) owner.operations.push(operation)
    else rows.push({ kind: 'operation', atMs, id: `operation:${atMs}:${index}`, operation })
  })
  return {
    rows: rows.sort((a, b) => a.atMs - b.atMs),
    incidents,
    transitions: events.map((event, index): TimelineRow => ({
      kind: 'transition',
      atMs: event.atMs,
      id: `transition:${event.atMs}:${index}`,
      event,
    })),
    eventCount: events.length + positioned.length,
    unpositionedOperations: timings.length - positioned.length,
  }
}

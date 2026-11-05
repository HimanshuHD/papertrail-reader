/** External analysis only. Caller chooses reviewed labels; no automatic publication. */
export function summarizeAllocationProfile(profile, classifyFrame) {
  const exclusive = new Map()
  const context = new Map()
  let totalBytes = 0
  const add = (map, label, bytes) => map.set(label, (map.get(label) ?? 0) + bytes)
  const visit = (node, ancestors) => {
    if (!Number.isFinite(node.selfSize) || node.selfSize < 0)
      throw new Error('Allocation nodes require finite nonnegative selfSize')
    const label = classifyFrame(node.callFrame)
    const groups = new Set(ancestors)
    if (label) groups.add(label)
    totalBytes += node.selfSize
    add(exclusive, label || '(unmapped)', node.selfSize)
    // A repeated caller in one stack owns each sampled byte only once.
    for (const group of groups) add(context, group, node.selfSize)
    for (const child of node.children ?? []) visit(child, groups)
  }
  visit(profile.head, new Set())
  const rows = (map) =>
    [...map].map(([group, bytes]) => ({ group, bytes })).sort((a, b) => b.bytes - a.bytes)
  return { totalBytes, exclusiveBytes: rows(exclusive), contextBytes: rows(context) }
}

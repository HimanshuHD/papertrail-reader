/** A new hover/focus target dismisses the previous tooltip, even across retained readers. */
let current: { id: symbol; dismiss: () => void } | undefined
export function claimTooltip(id: symbol, dismiss: () => void) {
  if (current?.id !== id) current?.dismiss()
  current = { id, dismiss }
}
export function releaseTooltip(id: symbol) {
  if (current?.id === id) current = undefined
}

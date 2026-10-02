/** Departing surfaces remain painted for motion but stop accepting focus or being announced. */
export function hideTransitionSurface(element: Element) {
  element.setAttribute('inert', '')
  element.setAttribute('aria-hidden', 'true')
}

/** Vue may reuse a surface when a toggle reverses an unfinished exit. */
export function restoreTransitionSurface(element: Element) {
  element.removeAttribute('inert')
  element.removeAttribute('aria-hidden')
}

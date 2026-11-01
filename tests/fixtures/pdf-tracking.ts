import type { PdfPageTracking } from '../../src/features/pdf/viewport-tracker'

/** Component-only fixture; tracker geometry and observer ownership have separate tests. */
export function immediatePdfTracking(): PdfPageTracking {
  return {
    register(_element, _page, proximity) {
      queueMicrotask(() => proximity(true))
      return () => {}
    },
    schedule() {},
  }
}

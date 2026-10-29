/** Bound layout readiness; rejected/late faces are removed before restoring position. */
export async function settleBookFonts(
  doc: Document,
  signal: AbortSignal,
  timeout = 3000,
): Promise<string | null> {
  signal.throwIfAborted()
  const fonts = doc.fonts
  if (!fonts || typeof fonts.forEach !== 'function') return null
  // Flush style so CSS-connected faces are available in FontFaceSet.
  doc.body?.getBoundingClientRect()
  const faces: FontFace[] = []
  fonts.forEach((face) => faces.push(face))
  if (!faces.length) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel!: () => void
  try {
    await Promise.race([
      Promise.all(faces.map((face) => face.load())).then(() => fonts.ready),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Font layout timed out.')), timeout)
      }),
      new Promise<never>((_, reject) => {
        cancel = () => reject(new DOMException('Font layout cancelled.', 'AbortError'))
        signal.addEventListener('abort', cancel, { once: true })
        if (signal.aborted) cancel()
      }),
    ])
    signal.throwIfAborted()
    return null
  } catch (error) {
    if (signal.aborted) throw error
    // Drop font-face rules, including nested @media; late loads must not reflow restored text.
    const remove = (sheet: CSSStyleSheet | CSSGroupingRule) => {
      for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
        const rule = sheet.cssRules[i]!
        if (rule.type === 5) sheet.deleteRule(i)
        else if ('cssRules' in rule) remove(rule as CSSGroupingRule)
      }
    }
    for (const sheet of Array.from(doc.styleSheets)) remove(sheet)
    doc.body?.getBoundingClientRect()
    return 'An embedded font could not load in time or was rejected. Fallback fonts are used.'
  } finally {
    clearTimeout(timer)
    if (cancel) signal.removeEventListener('abort', cancel)
  }
}

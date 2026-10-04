export const EPUB_FONT_SIZES = [14, 16, 18, 20, 22, 24, 28, 32] as const
export const EPUB_LINE_SPACING = [1.2, 1.4, 1.6, 1.8, 2, 2.2] as const
export const EPUB_READING_WIDTHS = [480, 640, 800] as const
export interface EpubTypography {
  fontSize: number | null
  lineSpacing: number | null
  readingWidth: number | null
}
export const DEFAULT_EPUB_TYPOGRAPHY: Readonly<EpubTypography> = Object.freeze({
  fontSize: null,
  lineSpacing: null,
  readingWidth: null,
})
export function normalizeTypography(settings: Partial<EpubTypography>): EpubTypography {
  const allowed = (value: number | null | undefined, values: readonly number[]) =>
    typeof value === 'number' && values.includes(value) ? value : null
  return {
    fontSize: allowed(settings.fontSize, EPUB_FONT_SIZES),
    lineSpacing: allowed(settings.lineSpacing, EPUB_LINE_SPACING),
    readingWidth: allowed(settings.readingWidth, EPUB_READING_WIDTHS),
  }
}
/** Numeric allowlists only; replace this sheet on every update so reset removes overrides. */
export function typographyCSS(settings: EpubTypography): string {
  const safe = normalizeTypography(settings)
  const rules: string[] = []
  if (safe.fontSize) {
    rules.push(
      `body{font-size:${safe.fontSize}px!important} p,li,dt,dd,blockquote,td,th,figcaption,pre,code,span,a{font-size:inherit!important}`,
    )
    rules.push(
      'h1{font-size:2em!important}h2{font-size:1.5em!important}h3{font-size:1.17em!important}h4,h5,h6{font-size:1em!important}',
    )
  }
  if (safe.lineSpacing) rules.push(`body,body *{line-height:${safe.lineSpacing}!important}`)
  if (safe.readingWidth)
    rules.push(
      `body{max-width:min(100%,${safe.readingWidth}px)!important;margin-left:auto!important;margin-right:auto!important}`,
    )
  // A nonempty sheet lets the engine clear previous explicit settings on reset.
  return rules.join('\n') || ':root{}'
}

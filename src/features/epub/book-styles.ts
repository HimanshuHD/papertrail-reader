import { bindBookViewportLengths } from './book-viewport'
import { parse, generate, walk, type CssNode } from 'css-tree'

const properties = new Set(
  `color background background-color background-image background-position background-size background-repeat font-family font-size font-style font-weight font-variant line-height text-align text-indent text-decoration text-transform letter-spacing word-spacing white-space vertical-align margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-width border-style border-color border-top border-right border-bottom border-left border-radius border-collapse border-spacing display width min-width max-width height min-height max-height box-sizing float clear list-style-type list-style-position table-layout break-before break-after break-inside page-break-before page-break-after page-break-inside orphans widows flex flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row`.split(
    ' ',
  ),
)
const functions = new Set(
  'rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix calc min max clamp linear-gradient radial-gradient repeating-linear-gradient repeating-radial-gradient repeat minmax fit-content'.split(
    ' ',
  ),
)

/** Parse CSS, rebuild approved declarations, and replace only verified local image URLs. */
export function sanitizeBookCSS(
  css: string,
  urls: ReadonlyMap<string, string> = new Map(),
  inline = false,
  fonts: ReadonlyMap<string, string> = new Map(),
  fontState = { remaining: 16, warn: () => {} },
): string {
  if (css.length > 256 * 1024) throw new Error('EPUB stylesheet exceeds its budget.')
  let ast: CssNode
  try {
    ast = parse(css, { context: inline ? 'declarationList' : 'stylesheet' })
  } catch {
    return ''
  }
  let nodes = 0,
    faces = 0,
    topFaces = 0
  ast.children?.forEach((node) => {
    if (node.type === 'Atrule' && node.name?.toLowerCase() === 'font-face') topFaces++
  })
  walk(ast, (node) => {
    if (++nodes > 20000) throw new Error('EPUB stylesheet is too complex.')
    if (node.type === 'Atrule' && node.name?.toLowerCase() === 'font-face') faces++
  })
  if (faces > topFaces) fontState.warn()
  function declarations(block: CssNode): string {
    const output: string[] = []
    block.children?.forEach((node) => {
      if (
        node.type !== 'Declaration' ||
        !properties.has(node.property?.toLowerCase() ?? '') ||
        typeof node.value !== 'object'
      )
        return
      let safe = true
      walk(node.value, (value) => {
        if (
          value.type === 'Raw' ||
          (value.type === 'Function' && !functions.has(value.name?.toLowerCase() ?? ''))
        )
          safe = false
        if (value.type === 'Url') {
          const replacement = typeof value.value === 'string' ? urls.get(value.value) : undefined
          if (!replacement) safe = false
          else value.value = replacement
        }
      })
      if (safe) {
        bindBookViewportLengths(node.value)
        output.push(generate(node))
      }
    })
    return output.join(';')
  }
  function fontSources(value: CssNode): string {
    const groups: CssNode[][] = [[]]
    value.children?.forEach((node) => {
      if (node.type === 'Operator' && node.value === ',') groups.push([])
      else groups[groups.length - 1]!.push(node)
    })
    const sources: string[] = []
    for (const group of groups) {
      let valid = true,
        urls = 0
      for (const node of group)
        walk(node, (value) => {
          if (value.type === 'Raw') valid = false
          if (value.type === 'Function' && value.name?.toLowerCase() !== 'format') valid = false
          if (value.type === 'Url') {
            const replacement = typeof value.value === 'string' ? fonts.get(value.value) : undefined
            if (!replacement) valid = false
            else {
              value.value = replacement
              urls++
            }
          }
        })
      if (valid && urls === 1) sources.push(group.map((node) => generate(node)).join(' '))
    }
    return sources.join(',')
  }
  function fontFace(block: CssNode): string {
    const output: string[] = []
    let family = false,
      source = false,
      safe = true
    block.children?.forEach((node) => {
      if (node.type !== 'Declaration' || typeof node.value !== 'object') return
      const property = node.property?.toLowerCase() ?? ''
      if (
        ![
          'font-family',
          'src',
          'font-style',
          'font-weight',
          'font-stretch',
          'unicode-range',
        ].includes(property)
      )
        return
      if (property === 'src') {
        const sources = fontSources(node.value)
        if (sources) {
          source = true
          output.push(`src:${sources}`)
        }
        return
      }
      let valid = true
      walk(node.value, (value) => {
        if (value.type === 'Raw' || value.type === 'Function' || value.type === 'Url') valid = false
      })
      if (
        property === 'font-family' &&
        !/^(?:"[^"\\]{1,128}"|'[^'\\]{1,128}'|[a-zA-Z][a-zA-Z0-9 _-]{0,127})$/u.test(
          generate(node.value),
        )
      )
        valid = false
      if (!valid) {
        safe = false
        return
      }
      family ||= property === 'font-family'
      output.push(generate(node))
    })
    if (!safe || !family || !source || fontState.remaining <= 0) {
      fontState.warn()
      return ''
    }
    fontState.remaining--
    // A bounded readiness gate handles failures before the reading position restores.
    return `@font-face{${output.join(';')};font-display:block}`
  }
  function rules(sheet: CssNode, depth = 0): string {
    if (depth > 8) throw new Error('EPUB stylesheet nesting is too deep.')
    const output: string[] = []
    sheet.children?.forEach((node) => {
      if (node.type === 'Rule' && node.prelude && node.block) {
        let safe = true
        walk(node.prelude, (selector) => {
          if (selector.type === 'Raw') safe = false
        })
        const content = declarations(node.block)
        if (safe && content) output.push(`${generate(node.prelude)}{${content}}`)
      } else if (node.type === 'Atrule' && node.name?.toLowerCase() === 'font-face' && node.block) {
        // Conditional face definitions could start a new font load after resize
        // and move an already-restored passage. Keep them as explicit fallback.
        if (depth > 0) return
        const face = fontFace(node.block)
        if (face) output.push(face)
      } else if (
        node.type === 'Atrule' &&
        node.name?.toLowerCase() === 'media' &&
        node.prelude &&
        node.block
      ) {
        let safe = true
        walk(node.prelude, (value) => {
          if (value.type === 'Raw' || value.type === 'Url') safe = false
        })
        if (safe) output.push(`@media ${generate(node.prelude)}{${rules(node.block, depth + 1)}}`)
      }
    })
    return output.join('\n')
  }
  return inline ? declarations(ast) : rules(ast)
}

export function stylesheetURLs(css: string, inline = false): string[] {
  if (css.length > 256 * 1024) throw new Error('EPUB stylesheet exceeds its budget.')
  try {
    const urls = new Set<string>()
    walk(parse(css, { context: inline ? 'declarationList' : 'stylesheet' }), (node) => {
      if (node.type === 'Url' && typeof node.value === 'string') urls.add(node.value)
    })
    return [...urls]
  } catch {
    return []
  }
}

/** Only font-face URLs can be admitted as font sources; generic CSS URLs stay image-only. */
export function stylesheetFontURLs(css: string): string[] {
  if (css.length > 256 * 1024) throw new Error('EPUB stylesheet exceeds its budget.')
  const urls = new Set<string>()
  try {
    const ast = parse(css)
    let count = 0
    walk(ast, () => {
      if (++count > 20000) throw new Error('EPUB stylesheet is too complex.')
    })
    // Conditional faces are unsupported, so do not read/admit their unused files.
    ast.children?.forEach((node) => {
      if (node.type !== 'Atrule' || node.name?.toLowerCase() !== 'font-face' || !node.block) return
      walk(node.block, (value) => {
        if (value.type === 'Url' && typeof value.value === 'string' && urls.size < 32)
          urls.add(value.value)
      })
    })
  } catch {
    return []
  }
  return [...urls]
}

/** Repeated linked sheets retain cascade order without creating duplicate font faces. */
export function withoutBookFontFaces(css: string): string {
  if (!css.includes('@font-face')) return css
  function copy(sheet: CssNode): string {
    const output: string[] = []
    sheet.children?.forEach((node) => {
      if (node.type === 'Atrule' && node.name?.toLowerCase() === 'font-face') return
      if (
        node.type === 'Atrule' &&
        node.name?.toLowerCase() === 'media' &&
        node.block &&
        node.prelude
      )
        output.push(`@media ${generate(node.prelude)}{${copy(node.block)}}`)
      else output.push(generate(node))
    })
    return output.join('\n')
  }
  return copy(parse(css))
}

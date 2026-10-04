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
): string {
  if (css.length > 256 * 1024) throw new Error('EPUB stylesheet exceeds its budget.')
  let ast: CssNode
  try {
    ast = parse(css, { context: inline ? 'declarationList' : 'stylesheet' })
  } catch {
    return ''
  }
  let nodes = 0
  walk(ast, () => {
    if (++nodes > 20000) throw new Error('EPUB stylesheet is too complex.')
  })
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
      if (safe) output.push(generate(node))
    })
    return output.join(';')
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

import { readFileSync } from 'node:fs'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { expect, it } from 'vitest'

it('keeps dark page filters and highlight opacity off the application root', () => {
  const source = readFileSync('src/components/viewer/PdfPageView.vue', 'utf8')
  const { descriptor } = parse(source)
  const style = descriptor.styles.at(-1)!
  const compiled = compileStyle({
    source: style.content,
    id: 'data-v-test',
    filename: 'PdfPageView.vue',
    scoped: style.scoped,
  })
  expect(compiled.errors).toEqual([])
  expect(compiled.code).toMatch(/:root\[data-theme='dark'\] \.pdf-page canvas\s*\{\s*filter:/)
  expect(compiled.code).toMatch(/:root:not\(\[data-theme\]\) \.pdf-page canvas\s*\{\s*filter:/)
  expect(compiled.code).not.toMatch(/:root[^{}]*\]\)?\s*\{\s*(?:filter|opacity|background):/)
})

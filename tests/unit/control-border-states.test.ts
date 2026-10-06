import { readFileSync } from 'node:fs'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { afterEach, expect, it } from 'vitest'

const main = readFileSync('src/assets/main.css', 'utf8')
function mountStyles(component: string, markup: string) {
  const { descriptor } = parse(readFileSync(component, 'utf8'))
  const scoped = descriptor.styles
    .map(
      (style) =>
        compileStyle({
          source: style.content,
          filename: component,
          id: 'data-v-border',
          scoped: style.scoped,
        }).code,
    )
    .join('\n')
  const style = document.createElement('style')
  style.textContent = (main.slice(main.indexOf('.pt-button-filled')) + scoped).replaceAll(
    ':hover',
    '.is-hovered',
  )
  // jsdom does not resolve custom properties inside border shorthands.
  style.textContent = style.textContent.replace(
    /var\(--pt-(?:line|brand|control-edge)\)/g,
    '#23686b',
  )
  document.head.append(style)
  document.body.innerHTML = markup
  document.body.querySelectorAll('*').forEach((el) => el.setAttribute('data-v-border', ''))
  return style
}
afterEach(() => {
  document.head.querySelectorAll('style').forEach((style) => style.remove())
  document.body.replaceChildren()
})
it('keeps four sides on framed note actions and stable save borders across hover', () => {
  mountStyles(
    'src/components/viewer/AnnotationsPanel.vue',
    '<button class="annotation-button pt-framed-control">Add note</button><button class="annotation-button pt-framed-control pt-stable-border">Save note</button><textarea class="annotation-input"></textarea>',
  )
  const [action, save, area] = Array.from(document.body.children) as HTMLElement[]
  expect(getComputedStyle(action!).borderBottomWidth).toBe('1px')
  action!.classList.add('is-hovered')
  expect(getComputedStyle(action!).borderBottomWidth).toBe('2px')
  save!.classList.add('is-hovered')
  expect(getComputedStyle(save!).borderBottomWidth).toBe('1px')
  expect(getComputedStyle(area!).borderLeftWidth).toBe('1px')
  expect(getComputedStyle(area!).borderRightWidth).toBe('1px')
})
it('keeps note marker right edge open and emphasizes its left edge for linked hover', () => {
  mountStyles(
    'src/components/viewer/NoteIndicator.vue',
    '<button class="reader-note-indicator pt-note-marker"></button>',
  )
  const marker = document.body.firstElementChild as HTMLElement
  expect(getComputedStyle(marker).borderRightWidth).toBe('0px')
  marker.classList.add('highlighted')
  expect(getComputedStyle(marker).borderLeftWidth).toBe('2px')
  expect(getComputedStyle(marker).borderBottomWidth).toBe('1px')
  expect(getComputedStyle(marker).borderRightWidth).toBe('0px')
})

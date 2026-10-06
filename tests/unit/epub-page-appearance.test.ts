import { expect, it } from 'vitest'
import { bindEpubPageAppearance } from '../../src/features/epub/page-appearance'
it('adapts dark chapter colors without changing content and restores authored colors in light mode', () => {
  const doc = document.implementation.createHTMLDocument('Book')
  doc.body.innerHTML =
    '<p style="color:black;background-color:white">Author text<img src="book.png"></p>'
  const before = doc.body.innerHTML
  const appearance = bindEpubPageAppearance(doc, true)
  expect(doc.head.querySelector('style')?.textContent).toContain('#111b22')
  expect(doc.body.innerHTML).toBe(before)
  appearance.set(false)
  expect(doc.head.querySelector('style')?.textContent).toBe('')
  appearance.dispose()
  expect(doc.head.querySelector('style')).toBeNull()
})

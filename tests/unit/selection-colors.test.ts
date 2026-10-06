import { expect, it } from 'vitest'
import { selectionColorPreview } from '../../src/features/annotations/selection-colors'
it('changes a readable pending-selection preview without mutating chapter text and disposes its style', () => {
  const doc = document.implementation.createHTMLDocument('Chapter')
  doc.body.innerHTML = '<p>Author text</p>'
  const before = doc.body.innerHTML
  const preview = selectionColorPreview(doc, 'yellow')
  expect(doc.head.querySelector('style')?.textContent).toContain('#fde68a')
  preview.set('pink')
  expect(doc.head.querySelector('style')?.textContent).toContain('#fbcfe8')
  expect(doc.head.querySelector('style')?.textContent).toContain('color: #173449')
  expect(doc.body.innerHTML).toBe(before)
  preview.dispose()
  expect(doc.head.querySelector('style')).toBeNull()
})

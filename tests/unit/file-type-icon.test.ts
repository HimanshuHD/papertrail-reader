import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import pdf from '../../src/assets/icons/pdf.svg'
import file from '../../src/assets/icons/file.svg'
import FileTypeIcon from '../../src/components/icons/FileTypeIcon.vue'
it('uses reusable fixed-size assets and a safe fallback for arbitrary extensions', async () => {
  const icon = mount(FileTypeIcon, { props: { extension: '.pdf' } })
  expect(icon.attributes('style')).toContain(pdf)
  for (const extension of ['EPUB', 'DOC', 'DOCX', '<script>']) {
    await icon.setProps({ extension })
    expect(icon.classes()).toEqual(['file-type-icon'])
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.html()).not.toContain('<script>')
  }
  expect(icon.attributes('style')).toContain(file)
})

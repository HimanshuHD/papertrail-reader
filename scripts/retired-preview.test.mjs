import test from 'node:test'
import assert from 'node:assert/strict'
import { retiredPreviewHtml } from './retired-preview.mjs'

test('sample and real retirement share the accessible page and correctly relative links', () => {
  const real = retiredPreviewHtml({ pr: 39 })
  const sample = retiredPreviewHtml({ pr: 39, demo: true })
  for (const html of [real, sample]) {
    assert.match(html, /aria-labelledby="status-title"/)
    assert.match(html, /href="\.\.\/\.\.\/"/)
    assert.match(html, /href="https:\/\/github.com\/HimanshuHD\/papertrail-reader\/pull\/39"/)
    assert.ok(!html.includes('<script'))
  }
  assert.match(real, /Preview archived/)
  assert.match(sample, /Design preview/)
  assert.match(sample, /PR preview is still active/)
  assert.throws(() => retiredPreviewHtml({ pr: '<script>' }), /Invalid PR/)
})

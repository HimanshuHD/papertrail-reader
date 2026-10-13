import test from 'node:test'
import assert from 'node:assert/strict'
import { deploymentUrl } from './deployment-url.mjs'

test('deployment links preserve the Pages repository base and choose the actual channel', () => {
  const root = 'https://himanshuhd.github.io/papertrail-reader/'
  assert.equal(deploymentUrl(root, 'production'), root)
  assert.equal(deploymentUrl(root, 'staging'), root + 'staging/')
  assert.equal(deploymentUrl(root, 'preview', 173), root + 'preview/pr-173/')
})
test('custom domains and missing trailing slash are supported', () => {
  assert.equal(
    deploymentUrl('https://reader.example/', 'staging'),
    'https://reader.example/staging/',
  )
  assert.equal(
    deploymentUrl('https://reader.example/app', 'preview', '173'),
    'https://reader.example/app/preview/pr-173/',
  )
})
test('invalid channels and preview numbers cannot produce misleading links', () => {
  for (const pr of ['', '../main', 0])
    assert.throws(() => deploymentUrl('https://reader.example/', 'preview', pr))
  assert.throws(() => deploymentUrl('https://reader.example/', 'other'))
  assert.throws(() => deploymentUrl('javascript:alert(1)', 'production'))
})

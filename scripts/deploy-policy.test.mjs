import test from 'node:test'
import assert from 'node:assert/strict'
import { affectsWebsite, previewDecision } from './deploy-policy.mjs'
test('website changes publish, documentation-only changes do not', () => {
  assert.equal(affectsWebsite(['docs/roadmap.md','README.md','.github/ISSUE_TEMPLATE/bug.yml']), false)
  for (const p of ['src/App.vue','package-lock.json','vite.config.ts','public/icon.svg','.github/workflows/pages.yml','scripts/deploy-policy.mjs']) assert.equal(affectsWebsite(['docs/a.md',p]), true)
})
test('open PRs publish only manually; closed previews retire; stale and fork builds skip', () => {
  const p={manual:false,state:'open',currentSha:'a',buildSha:'a',sameRepo:true,target:'main'}
  assert.equal(previewDecision(p),'skip')
  assert.equal(previewDecision({...p,manual:true}),'preview')
  assert.equal(previewDecision({...p,state:'closed'}),'retire')
  assert.throws(()=>previewDecision({...p,manual:true,state:'closed'}),/open PR/)
  assert.equal(previewDecision({...p,manual:true,buildSha:'old'}),'skip')
  assert.equal(previewDecision({...p,manual:true,sameRepo:false}),'skip')
})

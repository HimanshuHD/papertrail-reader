import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

test('Pages retries select only their own upload while retaining earlier attempt evidence', () => {
  const workflow = fs.readFileSync(
    fileURLToPath(new URL('../.github/workflows/pages.yml', import.meta.url)),
    'utf8',
  )
  const upload = workflow.match(
    /- uses: actions\/upload-pages-artifact@[\s\S]*?(?=\n {6}- uses:)/,
  )[0]
  const deploy = workflow.match(/- uses: actions\/deploy-pages@[\s\S]*?(?=\n {6}- name:)/)[0]
  const uploadName = upload.match(/^ {10}name: (.+)$/m)?.[1] || 'github-pages'
  const deployName = deploy.match(/^ {10}artifact_name: (.+)$/m)?.[1] || 'github-pages'
  const render = (name, run, attempt) =>
    name
      .replaceAll('${{ github.run_id }}', String(run))
      .replaceAll('${{ github.run_attempt }}', String(attempt))
  const artifacts = []
  for (const attempt of [1, 2, 3]) {
    artifacts.push({ name: render(uploadName, 42, attempt), attempt })
    const matches = artifacts.filter((item) => item.name === render(deployName, 42, attempt))
    assert.equal(matches.length, 1, 'deploy-pages requires exactly one matching artifact')
    assert.equal(matches[0].attempt, attempt, 'a retry must not publish earlier attempt bytes')
  }
  assert.equal(artifacts.length, 3, 'prior attempts remain available as evidence')
  assert.notEqual(render(uploadName, 42, 1), render(uploadName, 43, 1))
})

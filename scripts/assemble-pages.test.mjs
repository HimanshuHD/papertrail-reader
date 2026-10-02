import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assemble } from './assemble-pages.mjs'
test('production and PR previews coexist, stale production cannot overwrite, and retired previews stay navigable', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-pages-'))
  try {
    const site = path.join(root, 'site'),
      main = path.join(root, 'main'),
      preview = path.join(root, 'preview')
    for (const folder of [main, preview]) await mkdir(folder)
    await writeFile(path.join(main, 'index.html'), 'production')
    await writeFile(path.join(preview, 'index.html'), 'preview')
    await assemble({ site, artifact: main, kind: 'production', sha: 'main', runId: 20 })
    await assemble({ site, artifact: preview, kind: 'preview', pr: 7, sha: 'pr', runId: 21 })
    await assemble({ site, artifact: preview, kind: 'preview', pr: 8, sha: 'pr-8', runId: 22 })
    assert.equal(await readFile(path.join(site, 'index.html'), 'utf8'), 'production')
    await assemble({ site, artifact: main, kind: 'production', sha: 'new-main', runId: 22 })
    assert.equal(await readFile(path.join(site, 'preview/pr-7/index.html'), 'utf8'), 'preview')
    await assemble({ site, artifact: preview, kind: 'production', sha: 'stale', runId: 19 })
    assert.equal(await readFile(path.join(site, 'index.html'), 'utf8'), 'production')
    await assemble({ site, kind: 'retire', pr: 7 })
    assert.ok(
      (await readFile(path.join(site, 'preview/pr-7/index.html'), 'utf8')).includes(
        'href="../../"',
      ),
    )
    const retired = await readFile(path.join(site, 'preview/pr-7/index.html'), 'utf8')
    assert.ok(retired.includes('Pull request #7'))
    assert.ok(retired.includes('/pull/7'))
    assert.ok(retired.includes('<style>'))
    assert.ok(!retired.includes('<script'))
    assert.equal(await readFile(path.join(site, 'preview/pr-8/index.html'), 'utf8'), 'preview')
    await assert.rejects(assemble({ site, kind: 'preview', artifact: preview, pr: '../escape' }))
    await mkdir(path.join(preview, '.git'))
    await assert.rejects(assemble({ site, kind: 'preview', artifact: preview, pr: 9 }), /Reserved/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('publication retires closed previews while preserving production and open previews', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-reconcile-'))
  try {
    const site = path.join(root, 'site'),
      artifact = path.join(root, 'artifact')
    await mkdir(artifact)
    await writeFile(path.join(artifact, 'index.html'), 'content')
    await assemble({ site, artifact, kind: 'production', sha: 'main', runId: 20 })
    for (const pr of [7, 8])
      await assemble({ site, artifact, kind: 'preview', pr, sha: 'pr', runId: 21 })
    await assemble({
      site,
      artifact,
      kind: 'preview',
      pr: 9,
      sha: 'new',
      runId: 22,
      retirePRs: [7],
    })
    assert.equal(await readFile(path.join(site, 'index.html'), 'utf8'), 'content')
    assert.equal(await readFile(path.join(site, 'preview/pr-8/index.html'), 'utf8'), 'content')
    const state = JSON.parse(await readFile(path.join(site, 'deployment.json'), 'utf8'))
    assert.equal(state.production.sha, 'main')
    assert.equal(state.previews[7].status, 'retired')
    assert.equal(state.previews[8].status, 'active')
    assert.equal(state.previews[9].status, 'active')
    assert.ok(
      (await readFile(path.join(site, 'preview/pr-7/index.html'), 'utf8')).includes(
        'Pull request #7',
      ),
    )
    await assemble({
      site,
      artifact,
      kind: 'production',
      sha: 'next-main',
      runId: 23,
      retirePRs: [8],
    })
    assert.equal(
      JSON.parse(await readFile(path.join(site, 'deployment.json'), 'utf8')).previews[8].status,
      'retired',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

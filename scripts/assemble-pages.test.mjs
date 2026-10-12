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

test('aggregate recovery preserves the live sources and applies retirements even with a stale production request', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-recovery-'))
  try {
    const site = path.join(root, 'site'),
      artifact = path.join(root, 'artifact')
    await mkdir(artifact)
    await writeFile(path.join(artifact, 'index.html'), 'current')
    await assemble({ site, artifact, kind: 'production', sha: 'current', runId: 30 })
    for (const pr of [7, 8])
      await assemble({ site, artifact, kind: 'preview', pr, sha: 'preview', runId: 31 })
    await writeFile(path.join(site, '.publication-receipt.json'), 'old receipt')
    await assemble({ site, kind: 'reconcile', retirePRs: [7] })
    assert.equal(await readFile(path.join(site, 'index.html'), 'utf8'), 'current')
    assert.equal(await readFile(path.join(site, 'preview/pr-8/index.html'), 'utf8'), 'current')
    await assemble({ site, artifact, kind: 'production', sha: 'stale', runId: 20, retirePRs: [8] })
    const state = JSON.parse(await readFile(path.join(site, '.deployment-state.json'), 'utf8'))
    assert.equal(state.production.sha, 'current')
    assert.equal(state.previews[8].status, 'retired')
    assert.equal(
      await readFile(path.join(site, '.publication-receipt.json'), 'utf8'),
      'old receipt',
    )
    await writeFile(path.join(artifact, '.publication-receipt.json'), 'forged')
    await assert.rejects(
      assemble({ site, artifact, kind: 'production', sha: 'bad', runId: 40 }),
      /Reserved/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('staging survives production promotion, production survives staging failure/reconcile, and rollback holds preserve identity', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-channels-'))
  try {
    const site = path.join(root, 'site'),
      artifact = path.join(root, 'artifact')
    await mkdir(artifact)
    await writeFile(path.join(artifact, 'index.html'), 'release')
    const tree = 'a'.repeat(40)
    await assemble({
      site,
      artifact,
      kind: 'production',
      sha: 'main',
      sourceSha: 'merged-main',
      tree,
      runId: 40,
      version: '2.1.0',
    })
    await assemble({
      site,
      artifact,
      kind: 'staging',
      sha: 'stage',
      sourceSha: 'merged-stage',
      tree,
      runId: 41,
      version: '2.1.0',
    })
    assert.equal(
      JSON.parse(await readFile(path.join(site, 'staging/channel.json'), 'utf8')).aligned,
      true,
    )
    await writeFile(path.join(artifact, 'index.html'), 'next release')
    await assemble({
      site,
      artifact,
      kind: 'production',
      sha: 'new',
      tree: 'b'.repeat(40),
      runId: 42,
    })
    assert.equal(await readFile(path.join(site, 'staging/index.html'), 'utf8'), 'release')
    assert.equal(
      JSON.parse(await readFile(path.join(site, 'staging/channel.json'), 'utf8')).aligned,
      false,
    )
    const archive = path.join(site, '.deployment-archives/production/' + tree + '-40')
    await assemble({
      site,
      artifact: archive,
      kind: 'production',
      sha: 'main',
      tree,
      runId: 40,
      sourceSha: 'merged-main',
      holdSha: 'new-main',
      rollback: true,
      archiveId: tree + '-40',
    })
    const state = JSON.parse(await readFile(path.join(site, '.deployment-state.json'), 'utf8'))
    assert.equal(state.rollbackHold.production, 'new-main')
    assert.equal(state.production.sourceSha, 'merged-main')
    assert.equal(await readFile(path.join(site, 'index.html'), 'utf8'), 'release')
    await assemble({ site, artifact, kind: 'preview', pr: 170, branch: 'staging', runId: 43 })
    await assemble({ site, kind: 'reconcile', previewNotices: [{ pr: 170, draft: true }] })
    assert.equal(
      JSON.parse(await readFile(path.join(site, 'preview/pr-170/channel.json'), 'utf8')).draft,
      true,
    )
    await assemble({ site, kind: 'reconcile', retirePRs: [170] })
    assert.match(
      await readFile(path.join(site, 'preview/pr-170/index.html'), 'utf8'),
      /href="\.\.\/\.\.\/staging\/"/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

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
    assert.equal(await readFile(path.join(site, 'preview/pr-8/index.html'), 'utf8'), 'preview')
    await assert.rejects(assemble({ site, kind: 'preview', artifact: preview, pr: '../escape' }))
    await mkdir(path.join(preview, '.git'))
    await assert.rejects(assemble({ site, kind: 'preview', artifact: preview, pr: 9 }), /Reserved/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

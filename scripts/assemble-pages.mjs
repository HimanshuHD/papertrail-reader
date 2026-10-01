import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { retiredPreviewHtml } from './retired-preview.mjs'

async function validateArtifact(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    if (
      item.isSymbolicLink() ||
      ['.git', '.deployment-state.json', 'preview', 'CNAME'].includes(item.name)
    )
      throw new Error('Reserved or linked artifact path')
    if (item.isDirectory()) await validateArtifact(path.join(folder, item.name))
  }
}

export async function assemble({ site, artifact, kind, pr, sha, runId }) {
  await mkdir(site, { recursive: true })
  const statePath = path.join(site, '.deployment-state.json')
  let state = { previews: {}, production: null }
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!['production', 'preview', 'retire'].includes(kind))
    throw new Error('Invalid deployment kind')
  if (kind !== 'production' && !/^[1-9]\d*$/.test(String(pr))) throw new Error('Invalid PR number')
  if (kind !== 'retire') await validateArtifact(artifact)
  if (kind === 'production' && state.production && Number(runId) < Number(state.production.runId))
    return
  if (kind === 'production') {
    for (const item of await readdir(site)) {
      if (!['.git', 'preview', '.deployment-state.json', 'CNAME'].includes(item))
        await rm(path.join(site, item), { recursive: true, force: true })
    }
    await cp(artifact, site, { recursive: true })
    state.production = { sha, runId }
  } else {
    const target = path.join(site, 'preview', 'pr-' + pr)
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })
    if (kind === 'preview') {
      await cp(artifact, target, { recursive: true })
      state.previews[pr] = { sha, runId, status: 'active' }
    } else {
      await writeFile(path.join(target, 'index.html'), retiredPreviewHtml({ pr }))
      state.previews[pr] = { status: 'retired' }
    }
  }
  if (!state.production) {
    await writeFile(
      path.join(site, 'index.html'),
      '<!doctype html><html lang="en"><title>PaperTrail</title><h1>Production deployment is pending</h1><p>A preview is available at its PR URL. Production will be published by the next successful main build.</p></html>',
    )
  }
  await writeFile(statePath, JSON.stringify(state, null, 2))
  await writeFile(path.join(site, '.nojekyll'), '')
  await writeFile(path.join(site, 'deployment.json'), JSON.stringify(state, null, 2))
}

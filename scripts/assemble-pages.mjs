import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { retiredPreviewHtml } from './retired-preview.mjs'

export async function validateArtifact(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    if (
      item.isSymbolicLink() ||
      [
        '.git',
        '.deployment-state.json',
        '.publication-receipt.json',
        'preview',
        'staging',
        '.deployment-archives',
        '.deployment-history.json',
        'CNAME',
      ].includes(item.name)
    )
      throw new Error('Reserved or linked artifact path')
    if (item.isDirectory()) await validateArtifact(path.join(folder, item.name))
  }
}

export async function assemble({
  site,
  artifact,
  kind,
  pr,
  sha,
  runId,
  sourceSha,
  tree,
  version,
  branch,
  retirePRs = [],
  previewNotices = [],
  holdSha,
  rollback = false,
  archiveId,
}) {
  await mkdir(site, { recursive: true })
  const statePath = path.join(site, '.deployment-state.json')
  let state = { previews: {}, production: null }
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!['production', 'staging', 'preview', 'retire', 'reconcile'].includes(kind))
    throw new Error('Invalid deployment kind')
  if (['preview', 'retire'].includes(kind) && !/^[1-9]\d*$/.test(String(pr)))
    throw new Error('Invalid PR number')
  if (['production', 'staging', 'preview'].includes(kind)) await validateArtifact(artifact)
  if (
    ['production', 'staging'].includes(kind) &&
    !rollback &&
    state[kind] &&
    Number(runId) < Number(state[kind].runId)
  )
    kind = 'reconcile'
  if (['production', 'staging'].includes(kind) && tree) {
    const id = archiveId || tree + '-' + runId
    if (!/^[0-9a-f]{40}-[0-9]+$/.test(id)) throw new Error('Invalid archive identity')
    const archive = path.join(site, '.deployment-archives', kind, id)
    await mkdir(archive, { recursive: true })
    if (!rollback) await cp(artifact, archive, { recursive: true })
    state.rollbackHold ||= {}
    if (rollback) state.rollbackHold[kind] = holdSha
    else delete state.rollbackHold[kind]
  }
  if (kind === 'production') {
    for (const item of await readdir(site)) {
      if (
        ![
          '.git',
          'preview',
          'staging',
          '.deployment-archives',
          '.deployment-history.json',
          '.deployment-state.json',
          '.publication-receipt.json',
          'CNAME',
        ].includes(item)
      )
        await rm(path.join(site, item), { recursive: true, force: true })
    }
    await cp(artifact, site, { recursive: true })
    state.production = {
      sha,
      runId,
      sourceSha,
      tree,
      version,
      branch,
      archiveId: tree ? archiveId || tree + '-' + runId : undefined,
    }
  } else if (kind === 'staging') {
    const target = path.join(site, 'staging')
    await rm(target, { recursive: true, force: true })
    await cp(artifact, target, { recursive: true })
    state.staging = {
      sha,
      runId,
      sourceSha,
      tree,
      version,
      branch,
      archiveId: tree ? archiveId || tree + '-' + runId : undefined,
    }
  } else if (kind !== 'reconcile') {
    const target = path.join(site, 'preview', 'pr-' + pr)
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })
    if (kind === 'preview') {
      await cp(artifact, target, { recursive: true })
      state.previews[pr] = { sha, runId, sourceSha, tree, branch, status: 'active' }
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
  for (const number of retirePRs) {
    if (!/^[1-9]\d*$/.test(String(number))) throw new Error('Invalid retired PR number')
    const target = path.join(site, 'preview', 'pr-' + number)
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })
    await writeFile(
      path.join(target, 'index.html'),
      retiredPreviewHtml({
        pr: number,
        environment: state.previews[number]?.branch === 'staging' ? 'staging' : 'production',
      }),
    )
    state.previews[number] = { status: 'retired' }
  }
  for (const notice of previewNotices) {
    if (!/^[1-9]\d*$/.test(String(notice.pr)) || typeof notice.draft !== 'boolean')
      throw new Error('Invalid preview notice')
    if (state.previews[notice.pr]?.status === 'active')
      state.previews[notice.pr].draft = notice.draft
  }
  for (const [number, preview] of Object.entries(state.previews))
    if (preview.status === 'active')
      await writeFile(
        path.join(site, 'preview', 'pr-' + number, 'channel.json'),
        JSON.stringify({ draft: Boolean(preview.draft) }),
      )
  if (state.staging)
    await writeFile(
      path.join(site, 'staging', 'channel.json'),
      JSON.stringify({
        aligned: Boolean(state.production?.tree && state.staging.tree === state.production.tree),
        productionVersion: state.production?.version || '',
        stagingSha: state.staging.sourceSha || state.staging.sha,
      }),
    )
  if (state.production)
    await writeFile(
      path.join(site, 'channel.json'),
      JSON.stringify({
        channel: 'production',
        sourceSha: state.production.sourceSha || state.production.sha,
      }),
    )
  await writeFile(statePath, JSON.stringify(state, null, 2))
  await writeFile(path.join(site, '.nojekyll'), '')
  await writeFile(path.join(site, 'deployment.json'), JSON.stringify(state, null, 2))
}

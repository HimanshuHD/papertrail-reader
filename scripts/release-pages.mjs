import { readFile, writeFile, cp, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { assemble } from './assemble-pages.mjs'
import { verifyCandidate } from './candidate-artifact.mjs'
import { unpackRelease } from './release-package.mjs'

export async function deliverRelease({
  site,
  folder,
  meta,
  operation,
  holdSha,
  retirePRs = [],
  previewNotices = [],
}) {
  if (!['archive-release', 'promote-release', 'rollback-release'].includes(operation))
    throw Error('Unknown release operation')
  if (operation !== 'archive-release' && !/^[0-9a-f]{40}$/.test(holdSha))
    throw Error('Missing current-main publication boundary')
  let state = { previews: {}, production: null }
  try {
    state = JSON.parse(await readFile(path.join(site, '.deployment-state.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (operation === 'rollback-release') {
    const history = JSON.parse(await readFile(path.join(site, '.deployment-history.json'), 'utf8'))
    if (
      !Object.values(history.production || {}).some(
        (item) => item.releaseTag === meta.tag && item.packageSha256 === meta.packageSha256,
      )
    )
      throw Error('Rollback requires a previously acknowledged production release')
  }
  const existing = state.releases?.[meta.tag]
  if (existing && existing.packageSha256 !== meta.packageSha256)
    throw Error('Immutable release already exists with different bytes')
  const target = path.join(site, 'releases', meta.tag)
  if (existing) {
    const build = JSON.parse(await readFile(path.join(folder, 'versioned/build.json'), 'utf8'))
    await verifyCandidate(target, build)
  } else {
    try {
      await access(target)
      throw Error('Untracked immutable release directory')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await mkdir(path.dirname(target), { recursive: true })
    await cp(path.join(folder, 'versioned'), target, { recursive: true })
  }
  state.releases ||= {}
  state.releases[meta.tag] = meta
  await mkdir(site, { recursive: true })
  await writeFile(path.join(site, '.deployment-state.json'), JSON.stringify(state, null, 2))
  if (operation !== 'archive-release') {
    const archive = path.join(site, '.deployment-archives/production', `${meta.tree}-${meta.runId}`)
    await mkdir(path.dirname(archive), { recursive: true })
    await cp(path.join(folder, 'production'), archive, { recursive: true })
  }
  await assemble({
    site,
    kind: operation === 'archive-release' ? 'reconcile' : 'production',
    artifact: path.join(folder, 'production'),
    sha: meta.sha,
    sourceSha: meta.sha,
    tree: meta.tree,
    runId: meta.runId,
    version: meta.version,
    branch: 'main',
    rollback: operation !== 'archive-release',
    archiveId: `${meta.tree}-${meta.runId}`,
    holdSha,
    releaseTag: meta.tag,
    packageSha256: meta.packageSha256,
    retirePRs,
    previewNotices,
  })
}
export async function unpackSelectedRelease(plan, folder = 'incoming-release') {
  const bytes = await readFile('selected-release.json')
  const meta = await unpackRelease(bytes, plan.digest, folder, plan.expected)
  return { folder, meta }
}

import fs from 'node:fs/promises'
import { releaseVersion } from './release-package.mjs'

// Called only by the trusted publisher, never by a PR build.
export async function selectRelease({ github, owner, repo, tag, operation, basePath }) {
  releaseVersion(tag)
  if (!['archive-release', 'promote-release', 'rollback-release'].includes(operation))
    throw Error('Invalid release action')
  const release = (await github.rest.repos.getReleaseByTag({ owner, repo, tag })).data
  if (release.draft || release.prerelease || release.tag_name !== tag)
    throw Error('Use a published stable GitHub Release')
  const commit = (await github.rest.repos.getCommit({ owner, repo, ref: tag })).data
  const main = (await github.rest.repos.getBranch({ owner, repo, branch: 'main' })).data
  const comparison = (
    await github.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${commit.sha}...${main.commit.sha}`,
    })
  ).data
  if (!['ahead', 'identical'].includes(comparison.status))
    throw Error('Tag is not reachable from reviewed main')
  const name = `papertrail-${tag}.json`
  const assets = await github.paginate(github.rest.repos.listReleaseAssets, {
    owner,
    repo,
    release_id: release.id,
    per_page: 100,
  })
  const download = async (name) => {
    const asset = assets.find((item) => item.name === name)
    if (!asset) throw Error('Missing release asset: ' + name)
    const response = await github.rest.repos.getReleaseAsset({
      owner,
      repo,
      asset_id: asset.id,
      headers: { accept: 'application/octet-stream' },
    })
    return Buffer.from(response.data)
  }
  const checksum = (await download(name + '.sha256')).toString('utf8')
  const match = checksum.match(/^([0-9a-f]{64}) {2}(papertrail-v\d+\.\d+\.\d+\.json)\n$/)
  if (!match || match[2] !== name) throw Error('Invalid release checksum file')
  const expected = {
    tag,
    version: releaseVersion(tag),
    sha: commit.sha,
    tree: commit.commit.tree.sha,
    basePath,
  }
  const bytes = await download(name)
  // Verify all paths, identities and nested checksums before saving a publisher plan.
  const { unpackRelease } = await import('./release-package.mjs')
  await unpackRelease(bytes, match[1], 'release-preflight', expected)
  await fs.writeFile('selected-release.json', bytes)
  const plan = {
    operation,
    expected,
    digest: match[1],
    holdSha: main.commit.sha,
    releaseId: release.id,
  }
  await fs.writeFile('release-plan.json', JSON.stringify(plan))
  return plan
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  releaseVersion,
  validateTaggedPackages,
  packRelease,
  unpackRelease,
  sha256,
} from './release-package.mjs'
import { writeCandidate } from './candidate-artifact.mjs'
import { deliverRelease } from './release-pages.mjs'
import { assemble } from './assemble-pages.mjs'
const sha = 'a'.repeat(40),
  tree = 'b'.repeat(40),
  holdSha = 'c'.repeat(40)
async function fixture(root, tag = 'v2.2.0', runId = '100') {
  const folder = path.join(root, tag)
  const meta = {
    schema: 1,
    tag,
    version: tag.slice(1),
    sha,
    tree,
    runId,
    basePath: '/papertrail-reader/',
  }
  for (const channel of ['versioned', 'production']) {
    const dir = path.join(folder, channel)
    await mkdir(path.join(dir, 'assets'), { recursive: true })
    await writeFile(path.join(dir, 'index.html'), tag + '-' + channel)
    await writeFile(path.join(dir, 'assets/app.js'), 'console.log("' + tag + '")')
    await writeCandidate(dir, {
      sha,
      tree,
      headSha: sha,
      runId,
      pr: '',
      channel: channel === 'versioned' ? 'release' : channel,
      basePath:
        channel === 'versioned' ? `/papertrail-reader/releases/${tag}/` : '/papertrail-reader/',
      version: meta.version,
      sourceBranch: tag,
    })
  }
  const bytes = await packRelease(folder, meta),
    digest = sha256(bytes)
  const verified = path.join(root, tag + '-verified')
  const verifiedMeta = await unpackRelease(bytes, digest, verified, meta)
  return { folder: verified, meta: verifiedMeta, bytes, digest }
}
test('stable release tags and all three package versions must agree', () => {
  for (const tag of ['v01.2.3', 'v2.3', 'v2.3.4-rc.1', '../v2.3.4', '2.3.4'])
    assert.throws(() => releaseVersion(tag))
  assert.equal(
    validateTaggedPackages(
      'v2.2.0',
      { version: '2.2.0' },
      { version: '2.2.0', packages: { '': { version: '2.2.0' } } },
    ),
    '2.2.0',
  )
  assert.throws(() => validateTaggedPackages('v2.2.0', { version: '2.1.0' }, {}), /must match/)
  assert.throws(
    () =>
      validateTaggedPackages(
        'v2.2.0',
        { version: '2.2.0' },
        { version: '2.2.0', packages: { '': { version: '2.1.0' } } },
      ),
    /must match/,
  )
})
test('package extraction rejects tampering, traversal, reserved paths and wrong source/base identities', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-release-'))
  try {
    const f = await fixture(root)
    await assert.rejects(
      unpackRelease(f.bytes, '0'.repeat(64), path.join(root, 'bad'), {}),
      /checksum/,
    )
    await assert.rejects(
      unpackRelease(f.bytes, f.digest, path.join(root, 'bad'), { sha: holdSha }),
      /identity/,
    )
    for (const name of [
      '../../escape',
      '/absolute',
      'assets/../escape',
      'releases/overwrite',
      '.deployment-history.json',
    ]) {
      const obj = JSON.parse(f.bytes)
      obj.builds.versioned[name] = Buffer.from('evil').toString('base64')
      const bytes = Buffer.from(JSON.stringify(obj))
      await assert.rejects(
        unpackRelease(bytes, sha256(bytes), path.join(root, 'bad'), {}),
        /Unsafe|Reserved|checksum/,
      )
    }
    const obj = JSON.parse(f.bytes)
    obj.builds.production['index.html'] = Buffer.from('modified').toString('base64')
    const bytes = Buffer.from(JSON.stringify(obj))
    await assert.rejects(
      unpackRelease(bytes, sha256(bytes), path.join(root, 'bad'), {}),
      /checksum/,
    )
    const wrongBase = JSON.parse(f.bytes)
    const build = JSON.parse(Buffer.from(wrongBase.builds.versioned['build.json'], 'base64'))
    build.basePath = '/'
    wrongBase.builds.versioned['build.json'] = Buffer.from(JSON.stringify(build)).toString('base64')
    const wrongBytes = Buffer.from(JSON.stringify(wrongBase))
    await assert.rejects(
      unpackRelease(wrongBytes, sha256(wrongBytes), path.join(root, 'bad'), {}),
      /basePath/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('archive, promotion, receipt and rollback preserve all channels and immutable releases', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-release-delivery-'))
  try {
    const first = await fixture(root),
      second = await fixture(root, 'v2.3.0', '101')
    const site = path.join(root, '_site'),
      artifact = path.join(first.folder, 'production')
    await assemble({ site, artifact, kind: 'production', sha: 'original', runId: '90' })
    await assemble({ site, artifact, kind: 'staging', sha: 'staging', runId: '91' })
    await assemble({ site, artifact, kind: 'preview', pr: '5', sha: 'preview', runId: '92' })
    const options = { site, ...first, holdSha }
    await deliverRelease({ ...options, operation: 'archive-release' })
    let state = JSON.parse(await readFile(path.join(site, '.deployment-state.json')))
    assert.equal(state.production.sha, 'original')
    assert.equal(
      await readFile(path.join(site, 'releases/v2.2.0/index.html'), 'utf8'),
      'v2.2.0-versioned',
    )
    await deliverRelease({ ...options, operation: 'archive-release' })
    await assert.rejects(
      deliverRelease({
        ...options,
        meta: { ...first.meta, packageSha256: '0'.repeat(64) },
        operation: 'archive-release',
      }),
      /Immutable/,
    )
    await assert.rejects(
      deliverRelease({ ...options, operation: 'rollback-release' }),
      /ENOENT|previously acknowledged/,
    )
    await deliverRelease({ ...options, operation: 'promote-release' })
    execFileSync(process.execPath, [path.resolve('scripts/acknowledge-publication.mjs')], {
      cwd: root,
    })
    await deliverRelease({ site, ...second, holdSha, operation: 'promote-release' })
    execFileSync(process.execPath, [path.resolve('scripts/acknowledge-publication.mjs')], {
      cwd: root,
    })
    await deliverRelease({ ...options, operation: 'rollback-release' })
    state = JSON.parse(await readFile(path.join(site, '.deployment-state.json')))
    assert.equal(state.production.releaseTag, 'v2.2.0')
    assert.equal(state.rollbackHold.production, holdSha)
    assert.equal(state.staging.sha, 'staging')
    assert.equal(state.previews['5'].status, 'active')
    for (const tag of ['v2.2.0', 'v2.3.0'])
      assert.ok(await readFile(path.join(site, `releases/${tag}/index.html`)))
    // Subsequent ordinary main publication must retain immutable URLs.
    await assemble({ site, artifact, kind: 'production', sha: 'next-main', tree, runId: '200' })
    assert.ok(await readFile(path.join(site, 'releases/v2.3.0/index.html')))
    state = JSON.parse(await readFile(path.join(site, '.deployment-state.json')))
    assert.equal(state.rollbackHold.production, undefined)
    assert.equal(state.production.releaseTag, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('publisher refuses draft, prerelease, off-main tags and missing packages before planning', async () => {
  const { selectRelease } = await import('./select-release.mjs')
  for (const scenario of ['draft', 'prerelease', 'off-main', 'missing']) {
    const github = {
      rest: {
        repos: {
          getReleaseByTag: async () => ({
            data: {
              id: 1,
              tag_name: 'v2.2.0',
              draft: scenario === 'draft',
              prerelease: scenario === 'prerelease',
            },
          }),
          getCommit: async () => ({ data: { sha, commit: { tree: { sha: tree } } } }),
          getBranch: async () => ({ data: { commit: { sha: holdSha } } }),
          compareCommitsWithBasehead: async () => ({
            data: { status: scenario === 'off-main' ? 'diverged' : 'ahead' },
          }),
          listReleaseAssets: () => {},
        },
      },
      paginate: async () => [],
    }
    await assert.rejects(
      selectRelease({
        github,
        owner: 'owner',
        repo: 'repo',
        tag: 'v2.2.0',
        operation: 'promote-release',
        basePath: '/',
      }),
      /published stable|reachable|Missing release asset/,
    )
  }
})

test('tag packages have separate permissions from publication and no automatic production action', async () => {
  const workflow = await readFile('.github/workflows/release-package.yml', 'utf8')
  assert.match(workflow, /tags: \['v\*'\]/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /retention-days: 90/)
  assert.match(workflow, /git merge-base --is-ancestor/)
  assert.match(workflow, /draft:true/)
  assert.doesNotMatch(workflow, /deploy-pages@|id-token: write|pages: write/)
  const publisher = await readFile('.github/workflows/pages.yml', 'utf8')
  assert.match(publisher, /archive-release, promote-release, rollback-release/)
  assert.match(publisher, /group: pages-publisher/)
  assert.match(publisher, /Release\/main changed while publishing/)
})

test('advanced main resumes after release promotion even when its validated candidate ran earlier', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'release-main-order-'))
  try {
    const release = await fixture(root, 'v2.2.0', '100')
    const site = path.join(root, '_site')
    await deliverRelease({ site, ...release, holdSha, operation: 'promote-release' })
    const artifact = path.join(release.folder, 'production')
    // A candidate from the held main boundary must not displace the release.
    await assemble({
      site,
      artifact,
      kind: 'production',
      sha: holdSha,
      sourceSha: holdSha,
      tree,
      runId: '95',
    })
    let state = JSON.parse(await readFile(path.join(site, '.deployment-state.json')))
    assert.equal(state.production.releaseTag, 'v2.2.0')
    assert.equal(state.rollbackHold.production, holdSha)
    // This reviewed main merge advances the boundary, but its PR CI predates tag packaging.
    const advancedMain = 'd'.repeat(40)
    await assemble({
      site,
      artifact,
      kind: 'production',
      sha: advancedMain,
      sourceSha: advancedMain,
      tree,
      runId: '95',
    })
    state = JSON.parse(await readFile(path.join(site, '.deployment-state.json')))
    assert.equal(state.production.sourceSha, advancedMain)
    assert.equal(state.production.releaseTag, undefined)
    assert.equal(state.rollbackHold.production, undefined)
    assert.ok(await readFile(path.join(site, 'releases/v2.2.0/index.html')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

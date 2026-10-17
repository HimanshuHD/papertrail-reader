import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { artifactFiles, verifyCandidate } from './candidate-artifact.mjs'

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export function releaseVersion(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
    throw Error('Release requires a stable vX.Y.Z tag')
  return tag.slice(1)
}
export function validateTaggedPackages(tag, pkg, lock) {
  const version = releaseVersion(tag)
  if (
    pkg.version !== version ||
    lock.version !== version ||
    lock.packages?.['']?.version !== version
  )
    throw Error('Tagged package and lock versions must match the release tag')
  return version
}
export function validateReleaseIdentity(meta, expected = {}) {
  if (meta.schema !== 1 || meta.version !== releaseVersion(meta.tag))
    throw Error('Invalid release schema/version')
  for (const key of ['sha', 'tree'])
    if (!/^[0-9a-f]{40}$/.test(meta[key])) throw Error('Invalid release source identity')
  if (!/^[1-9]\d*$/.test(String(meta.runId)) || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(meta.basePath))
    throw Error('Invalid release run/base path')
  for (const [key, value] of Object.entries(expected))
    if (meta[key] !== value) throw Error('Release identity mismatch: ' + key)
}
export async function packRelease(folder, meta) {
  validateReleaseIdentity(meta)
  const builds = {}
  for (const channel of ['versioned', 'production']) {
    const dir = path.join(folder, channel)
    const build = JSON.parse(await readFile(path.join(dir, 'build.json'), 'utf8'))
    await verifyCandidate(dir, build)
    builds[channel] = {}
    for (const file of [...Object.keys(await artifactFiles(dir)), 'build.json'].sort())
      builds[channel][file] = (await readFile(path.join(dir, file))).toString('base64')
  }
  return Buffer.from(JSON.stringify({ ...meta, builds }))
}
export async function unpackRelease(bytes, digest, folder, expected) {
  if (!/^[0-9a-f]{64}$/.test(digest) || sha256(bytes) !== digest)
    throw Error('Release package checksum mismatch')
  const pkg = JSON.parse(bytes.toString('utf8'))
  validateReleaseIdentity(pkg, expected)
  if (
    Object.keys(pkg.builds || {})
      .sort()
      .join() !== 'production,versioned'
  )
    throw Error('Missing release builds')
  // Validate every path before creating files. JSON contains regular file bytes only; no archive links.
  for (const files of Object.values(pkg.builds)) {
    if (!files['build.json'] || !files['index.html']) throw Error('Incomplete release build')
    for (const [name, encoded] of Object.entries(files)) {
      if (
        !/^[A-Za-z0-9_.@/-]+$/.test(name) ||
        name
          .split('/')
          .some(
            (part) =>
              !part ||
              part === '.' ||
              part === '..' ||
              [
                '.git',
                '.deployment-state.json',
                '.publication-receipt.json',
                '.deployment-history.json',
                '.deployment-archives',
                'releases',
                'preview',
                'staging',
                'CNAME',
              ].includes(part),
          ) ||
        path.isAbsolute(name)
      )
        throw Error('Unsafe release path')
      if (
        typeof encoded !== 'string' ||
        Buffer.from(encoded, 'base64').toString('base64') !== encoded
      )
        throw Error('Non-canonical release file encoding')
    }
  }
  await rm(folder, { recursive: true, force: true })
  for (const [channel, files] of Object.entries(pkg.builds)) {
    const dir = path.join(folder, channel)
    for (const [name, encoded] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, name)), { recursive: true })
      await writeFile(path.join(dir, name), Buffer.from(encoded, 'base64'))
    }
    const expectedBuild = {
      tree: pkg.tree,
      channel: channel === 'versioned' ? 'release' : 'production',
      runId: pkg.runId,
      pr: '',
      headSha: pkg.sha,
      basePath: channel === 'versioned' ? `${pkg.basePath}releases/${pkg.tag}/` : pkg.basePath,
    }
    const build = await verifyCandidate(dir, expectedBuild)
    if (build.sha !== pkg.sha || build.version !== pkg.version || build.sourceBranch !== pkg.tag)
      throw Error('Release build does not match tagged source')
  }
  const meta = Object.fromEntries(Object.entries(pkg).filter(([key]) => key !== 'builds'))
  return { ...meta, packageSha256: digest }
}

import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function artifactFiles(folder, relative = '') {
  const files = {}
  for (const entry of await readdir(path.join(folder, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name)
    if (
      entry.isSymbolicLink() ||
      [
        '.git',
        '.deployment-state.json',
        '.publication-receipt.json',
        'releases',
        '.deployment-archives',
        '.deployment-history.json',
        'preview',
        'staging',
        '_deployments',
        'CNAME',
      ].includes(entry.name)
    )
      throw new Error('Reserved or linked artifact path')
    if (entry.isDirectory()) Object.assign(files, await artifactFiles(folder, name))
    else if (!entry.isFile()) throw new Error('Unsupported artifact entry')
    else if (name !== 'build.json')
      files[name] = createHash('sha256')
        .update(await readFile(path.join(folder, name)))
        .digest('hex')
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
}

export async function writeCandidate(folder, identity) {
  const build = { schema: 2, ...identity, files: await artifactFiles(folder) }
  await writeFile(path.join(folder, 'build.json'), JSON.stringify(build, null, 2))
  return build
}

export async function verifyCandidate(folder, expected) {
  const build = JSON.parse(await readFile(path.join(folder, 'build.json'), 'utf8'))
  if (build.schema !== 2) throw new Error('Unsupported artifact schema; run fresh candidate CI')
  for (const key of ['tree', 'channel', 'runId', 'pr', 'headSha', 'basePath']) {
    if (String(build[key]) !== String(expected[key]))
      throw new Error('Artifact identity mismatch: ' + key)
  }
  if (!/^[0-9a-f]{40}$/.test(build.sha) || !/^[0-9a-f]{40}$/.test(build.tree))
    throw new Error('Invalid source identity')
  const actual = await artifactFiles(folder)
  if (!actual['index.html'] || JSON.stringify(actual) !== JSON.stringify(build.files))
    throw new Error('Artifact checksum mismatch')
  return build
}

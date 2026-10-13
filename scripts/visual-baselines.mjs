import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
export async function validateBaselines(root = 'tests/visual/baselines') {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'approval.json'), 'utf8'))
  if (manifest.schema !== 1 || typeof manifest.enabled !== 'boolean')
    throw new Error('Invalid baseline schema')
  if (!manifest.enabled) return manifest
  const approval = manifest.approval
  if (
    approval?.owner !== 'HimanshuHD' ||
    !/^https:\/\/github\.com\/HimanshuHD\/papertrail-reader\/(pull|issues)\/\d+(#.*)?$/.test(
      approval.reviewUrl || '',
    ) ||
    !/^[0-9a-f]{40}$/.test(approval.sourceSha || '') ||
    !approval.evidenceRun ||
    !approval.reviewedAt
  )
    throw new Error('Explicit owner approval/evidence identity is required')
  if (
    manifest.profile !== 'startup' ||
    manifest.environment?.os !== 'ubuntu-24.04' ||
    manifest.environment?.playwright !== '1.63.0' ||
    manifest.environment?.browser !== 'chromium' ||
    manifest.environment?.density !== 1 ||
    !manifest.environment?.browserVersion
  )
    throw new Error('Baseline environment must match pinned capture environment')
  const states = ['loading', 'loading-reduced', 'ready', 'library-hidden', 'error', 'retry-ready']
  const expected = [375, 1440, 1586]
    .flatMap((width) =>
      ['light', 'dark'].flatMap((theme) =>
        states.map((state) => `chromium-${width}-${theme}/${state}.png`),
      ),
    )
    .sort()
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(expected))
    throw new Error('Baseline matrix is incomplete or unexpected')
  for (const [relative, hash] of Object.entries(manifest.files)) {
    const file = path.join(root, relative)
    if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Linked baseline')
    if (
      createHash('sha256')
        .update(await fs.readFile(file))
        .digest('hex') !== hash
    )
      throw new Error('Baseline checksum mismatch: ' + relative)
  }
  return manifest
}

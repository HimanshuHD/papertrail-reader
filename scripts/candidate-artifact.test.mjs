import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeCandidate, verifyCandidate } from './candidate-artifact.mjs'

test('verified promotion is bound to channel, content tree, run, PR and base path; modified bytes fail', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'papertrail-candidate-'))
  try {
    await writeFile(path.join(folder, 'index.html'), 'candidate')
    const expected = {
      sha: 'a'.repeat(40),
      tree: 'b'.repeat(40),
      runId: '42',
      pr: '170',
      headSha: 'c'.repeat(40),
      channel: 'staging',
      basePath: '/papertrail-reader/staging/',
    }
    await writeCandidate(folder, expected)
    await verifyCandidate(folder, expected)
    for (const change of [
      { tree: 'd'.repeat(40) },
      { runId: '43' },
      { channel: 'production' },
      { basePath: '/' },
      { pr: '171' },
      { headSha: 'd'.repeat(40) },
    ])
      await assert.rejects(verifyCandidate(folder, { ...expected, ...change }), /identity mismatch/)
    await writeFile(path.join(folder, 'index.html'), 'changed bytes')
    await assert.rejects(verifyCandidate(folder, expected), /checksum mismatch/)
    await writeFile(path.join(folder, '.publication-receipt.json'), '{}')
    await assert.rejects(writeCandidate(folder, expected), /Reserved/)
    await rm(path.join(folder, '.publication-receipt.json'))
    await symlink('/etc/passwd', path.join(folder, 'linked'))
    await assert.rejects(writeCandidate(folder, expected), /linked/)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})

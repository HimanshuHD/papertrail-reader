import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { selectBaselines, validateBaselines } from './visual-baselines.mjs'

test('each deployed channel selects and verifies its own complete approved matrix', async () => {
  assert.equal((await validateBaselines()).enabled, false)
  for (const channel of ['preview', 'staging', 'production']) {
    const selected = await selectBaselines(channel)
    assert.equal(selected.manifest.channel, channel)
    assert.equal(selected.manifest.approval.channel, channel)
    assert.equal(Object.keys(selected.manifest.files).length, 36)
  }
  await assert.rejects(selectBaselines('release'), /No approved baseline/)
  await assert.rejects(selectBaselines(undefined), /No approved baseline/)
})

test('channel selection refuses path substitution, mismatched approval and checksum tampering', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-baseline-'))
  try {
    const registry = JSON.parse(await fs.readFile('tests/visual/baselines/channels.json', 'utf8'))
    const writeRegistry = () =>
      fs.writeFile(path.join(root, 'channels.json'), JSON.stringify(registry))
    await writeRegistry()
    const target = path.join(root, 'channels/preview')
    await fs.cp('tests/visual/baselines/channels/preview', target, { recursive: true })
    const file = path.join(target, 'approval.json')
    const manifest = JSON.parse(await fs.readFile(file, 'utf8'))
    const writeManifest = () => fs.writeFile(file, JSON.stringify(manifest))
    assert.equal((await selectBaselines('preview', root)).manifest.channel, 'preview')
    registry.channels.preview = '../production'
    await writeRegistry()
    await assert.rejects(selectBaselines('preview', root), /registry/)
    registry.channels.preview = 'channels/preview'
    await writeRegistry()
    manifest.approval.channel = 'production'
    await writeManifest()
    await assert.rejects(selectBaselines('preview', root), /channel mismatch/)
    manifest.approval.channel = 'preview'
    await writeManifest()
    await fs.appendFile(path.join(target, 'chromium-375-light/loading.png'), 'tampered')
    await assert.rejects(selectBaselines('preview', root), /checksum/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('channel preparation cannot self-adopt in CI or accept an unapproved artifact digest', async () => {
  const script = path.resolve('scripts/prepare-channel-baselines.mjs')
  const ci = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  })
  assert.notEqual(ci.status, 0)
  assert.match(ci.stderr, /forbidden in CI/)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-preparation-'))
  try {
    await fs.writeFile(path.join(root, 'artifact.zip'), 'unapproved bytes')
    await fs.writeFile(
      path.join(root, 'review.json'),
      JSON.stringify({ channel: 'preview', artifactZipSha256: '0'.repeat(64) }),
    )
    const result = spawnSync(process.execPath, [script, 'artifact.zip', 'review.json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: '' },
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ZIP checksum mismatch/)
    assert.deepEqual((await fs.readdir(root)).sort(), ['artifact.zip', 'review.json'])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

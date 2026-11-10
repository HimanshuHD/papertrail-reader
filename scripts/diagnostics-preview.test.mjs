import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { startDiagnosticPreview } from './diagnostics-preview.mjs'

test('both preview servers accept literal paths containing spaces, apostrophes and Unicode', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "PaperTrail O'Brien 測試 "))
  try {
    for (const mode of ['production', 'diagnostic']) {
      await mkdir(path.join(root, mode))
      await writeFile(path.join(root, mode, 'index.html'), `<main>${mode} fixture</main>`)
      const server = await startDiagnosticPreview(mode, { DIAGNOSTIC_BUILD_ROOT: root }, 0)
      try {
        const address = server.httpServer.address()
        const response = await fetch(`http://127.0.0.1:${address.port}/`)
        assert.equal(response.status, 200)
        assert.equal(await response.text(), `<main>${mode} fixture</main>`)
      } finally {
        await new Promise((resolve, reject) =>
          server.httpServer.close((error) => (error ? reject(error) : resolve())),
        )
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('preview bootstrap rejects missing, relative and unknown build inputs', async () => {
  await assert.rejects(
    startDiagnosticPreview('other', { DIAGNOSTIC_BUILD_ROOT: os.tmpdir() }),
    /Unknown/,
  )
  await assert.rejects(startDiagnosticPreview('production', {}), /absolute path/)
  await assert.rejects(
    startDiagnosticPreview('production', { DIAGNOSTIC_BUILD_ROOT: 'relative/builds' }),
    /absolute path/,
  )
})

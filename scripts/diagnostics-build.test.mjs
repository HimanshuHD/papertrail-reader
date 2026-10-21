import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('production excludes diagnostics; explicit build includes the opt-in panel and recorder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-diagnostics-'))
  try {
    for (const enabled of [false, true]) {
      const out = path.join(root, enabled ? 'diagnostic' : 'production')
      const build = spawnSync(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'build', '--outDir', out],
        {
          env: { ...process.env, VITE_READER_DIAGNOSTICS: String(enabled) },
          encoding: 'utf8',
          timeout: 120000,
        },
      )
      assert.equal(build.status, 0, build.stdout + build.stderr)
      const files = await readdir(path.join(out, 'assets'))
      const source = (
        await Promise.all(
          files
            .filter((file) => file.endsWith('.js'))
            .map((file) => readFile(path.join(out, 'assets', file), 'utf8')),
        )
      ).join('\n')
      for (const marker of [
        'Developer diagnostics',
        'samplerOverhead',
        'pdf.open-readable',
        'droppedTimings',
        'library.first-listing',
      ]) {
        assert.equal(source.includes(marker), enabled, `${marker}: unexpected diagnostics presence`)
      }
      assert.equal(
        files.some((file) => file.startsWith('DeveloperDiagnostics')),
        enabled,
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

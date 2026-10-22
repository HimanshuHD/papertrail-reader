import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createDiagnosticLibrary } from './create-diagnostics-library.mjs'

test('manual folder fixtures have exact counts, nested groups and valid image/text/EPUB signatures', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'diagnostics-library-'))
  try {
    for (const count of [100, 1000]) {
      const { library, manifest } = await createDiagnosticLibrary(parent, count)
      const groups = await readdir(library)
      assert.equal(groups.length, Math.ceil(count / 50))
      let files = 0,
        bytes = 0
      for (const group of groups)
        for (const name of await readdir(path.join(library, group))) {
          const buffer = await readFile(path.join(library, group, name))
          files++
          bytes += buffer.length
          assert.equal(
            buffer.subarray(0, name.endsWith('.pdf') ? 5 : 2).toString(),
            name.endsWith('.pdf') ? '%PDF-' : 'PK',
          )
        }
      assert.equal(files, count)
      assert.equal(bytes, manifest.bytes)
      const image = await readFile(path.join(library, 'group-00', 'fixture-0000.pdf'))
      assert.equal(image.toString('latin1').match(/\/Subtype \/Image/g).length, 12)
      assert.ok(image.length > 9_000_000)
    }
    await assert.rejects(createDiagnosticLibrary(parent, 500), /100 or 1000/)
    assert.equal((await readdir(parent)).length, 2)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

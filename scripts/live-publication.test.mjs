import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const script = (name) => fileURLToPath(new URL(name, import.meta.url))
test('live verification rejects wrong asset bytes and stale retirement before a receipt is acknowledged', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'papertrail-live-'))
  let corrupt = false,
    staleRetirement = false
  const html = '<html>accepted reader</html>',
    js = 'const accepted = true',
    retired = '<html>Preview closed</html>'
  const digest = (value) => createHash('sha256').update(value).digest('hex')
  const build = {
    sha: 'a'.repeat(40),
    runId: '42',
    files: { 'index.html': digest(html), 'assets/app.js': digest(js) },
  }
  const state = {
    production: { sha: build.sha, runId: build.runId, archiveId: 'b'.repeat(40) + '-42' },
    previews: { 170: { status: 'retired' } },
  }
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/build.json') response.end(JSON.stringify(build))
    else if (pathname === '/index.html') response.end(html)
    else if (pathname === '/assets/app.js') response.end(corrupt ? 'wrong bytes' : js)
    else if (pathname === '/preview/pr-170/index.html')
      response.end(staleRetirement ? html : retired)
    else {
      response.statusCode = 404
      response.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await mkdir(path.join(root, '_site/preview/pr-170'), { recursive: true })
    await writeFile(path.join(root, '_site/build.json'), JSON.stringify(build))
    await writeFile(path.join(root, '_site/.deployment-state.json'), JSON.stringify(state))
    await writeFile(path.join(root, '_site/preview/pr-170/index.html'), retired)
    const env = {
      ...process.env,
      SITE_URL: `http://127.0.0.1:${server.address().port}/`,
      LIVE_VERIFY_ATTEMPTS: '1',
      LIVE_VERIFY_DELAY_MS: '0',
    }
    await exec('node', [script('verify-live.mjs')], { cwd: root, env })
    corrupt = true
    await assert.rejects(
      exec('node', [script('verify-live.mjs')], { cwd: root, env }),
      /Live asset checksum mismatch/,
    )
    corrupt = false
    staleRetirement = true
    await assert.rejects(
      exec('node', [script('verify-live.mjs')], { cwd: root, env }),
      /Live asset checksum mismatch/,
    )
    await assert.rejects(readFile(path.join(root, '_site/.publication-receipt.json')), /ENOENT/)
    staleRetirement = false
    await exec('node', [script('verify-live.mjs')], { cwd: root, env })
    await exec('node', [script('acknowledge-publication.mjs')], { cwd: root, env })
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, '_site/.publication-receipt.json'), 'utf8')),
      state,
    )
    assert.ok(
      JSON.parse(await readFile(path.join(root, '_site/.deployment-history.json'), 'utf8'))
        .production[state.production.archiveId],
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

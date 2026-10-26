import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./install-browser-window-manager.sh', import.meta.url))
// Execute the real helper with a fake package manager; no network or system mutation.
for (const failure of [false, true]) {
  test(
    `window-manager install isolates signed Ubuntu sources and cleans up on ${failure ? 'failure' : 'success'}`,
    {
      skip: process.platform === 'win32' ? 'POSIX CI package installer; executed on Linux' : false,
    },
    () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'papertrail-apt-'))
      const bin = path.join(root, 'bin')
      const log = path.join(root, 'calls')
      fs.mkdirSync(bin)
      fs.writeFileSync(
        path.join(bin, 'apt-get'),
        `#!/bin/sh
printf '%s\\n' "$@" >> "$WM_TEST_LOG"
for arg do
  case "$arg" in
    Dir::Etc::sourcelist=*) cat "\${arg#*=}" >> "$WM_TEST_LOG" ;;
  esac
done
exit "\${WM_TEST_APT_EXIT:-0}"
`,
        { mode: 0o755 },
      )
      for (const command of ['openbox', 'xvfb-run'])
        fs.writeFileSync(path.join(bin, command), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      try {
        const run = () =>
          execFileSync('sh', [script], {
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH}`,
              WM_TEST_LOG: log,
              WM_TEST_APT_EXIT: failure ? '42' : '0',
            },
            stdio: 'pipe',
          })
        if (failure) assert.throws(run, (error) => error.status === 42)
        else run()
        const calls = fs.readFileSync(log, 'utf8')
        assert.match(calls, /https:\/\/archive.ubuntu.com\/ubuntu noble main universe/)
        assert.match(calls, /https:\/\/security.ubuntu.com\/ubuntu noble-security main universe/)
        assert.match(calls, /signed-by=\/usr\/share\/keyrings\/ubuntu-archive-keyring.gpg/)
        assert.match(calls, /Dir::Etc::sourceparts=-/)
        assert.match(calls, /Acquire::https::Timeout=30/)
        assert.match(calls, /Acquire::Retries=1/)
        assert.doesNotMatch(calls, /azure|nodesource|trusted=yes|allow-unauthenticated/)
        assert.equal(calls.includes('install\n-y\n--no-install-recommends\nopenbox'), !failure)
        const sources = calls.match(/Dir::Etc::sourcelist=(.+)/)[1]
        assert.equal(fs.existsSync(path.dirname(sources)), false)
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    },
  )
}

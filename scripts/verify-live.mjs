import fs from 'node:fs'
import { createHash } from 'node:crypto'
const site = new URL(process.env.SITE_URL)
const state = JSON.parse(fs.readFileSync('_site/.deployment-state.json', 'utf8'))
const attempts = Math.max(1, Math.min(12, Number(process.env.LIVE_VERIFY_ATTEMPTS) || 12))
const delay = Math.max(0, Math.min(15000, Number(process.env.LIVE_VERIFY_DELAY_MS ?? 5000)))
async function check(relative, expected, digest) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const url = new URL(relative, site)
      url.searchParams.set('publication', String(Date.now()))
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      if (expected) {
        const build = await response.json()
        if (build.sha !== expected.sha || String(build.runId) !== String(expected.runId))
          throw new Error('Live identity mismatch')
      } else {
        const bytes = Buffer.from(await response.arrayBuffer())
        if (digest && createHash('sha256').update(bytes).digest('hex') !== digest)
          throw new Error('Live asset checksum mismatch')
      }
      return
    } catch (error) {
      if (attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
for (const channel of ['production', 'staging']) {
  if (!state[channel]) continue
  const prefix = channel === 'production' ? '' : 'staging/'
  await check(prefix + 'build.json', state[channel])
  const build = JSON.parse(fs.readFileSync('_site/' + prefix + 'build.json', 'utf8'))
  for (const file of Object.keys(build.files || {}).filter(
    (name) => name === 'index.html' || /\.(m?js|css)$/.test(name),
  ))
    await check(prefix + file, undefined, build.files[file])
}
for (const [number, preview] of Object.entries(state.previews || {})) {
  if (preview.status === 'active') await check(`preview/pr-${number}/build.json`, preview)
  else if (preview.status === 'retired')
    await check(
      `preview/pr-${number}/index.html`,
      undefined,
      createHash('sha256')
        .update(fs.readFileSync(`_site/preview/pr-${number}/index.html`))
        .digest('hex'),
    )
}
console.log('Live deployment identities and critical assets verified')

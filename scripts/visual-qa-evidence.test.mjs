import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { validateBaselines } from './visual-baselines.mjs'
const root = path.resolve('.')
const projects = [375, 1440, 1586].flatMap((width) =>
  ['light', 'dark'].map((theme) => `chromium-${width}-${theme}`),
)
const states = ['loading', 'loading-reduced', 'ready', 'library-hidden', 'error', 'retry-ready']
// Synthetic byte fixtures validate reporting contracts, not browser/design acceptance.
test('complete synthetic evidence reports captured/pending; missing or stale capture stays blocked', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-report-'))
  try {
    await fs.mkdir(path.join(folder, 'tests/visual/references'), { recursive: true })
    await fs.cp(
      path.join(root, 'tests/visual/references/startup-owner.webp'),
      path.join(folder, 'tests/visual/references/startup-owner.webp'),
    )
    await fs.cp(
      path.join(root, 'tests/visual/references/startup-owner.json'),
      path.join(folder, 'tests/visual/references/startup-owner.json'),
    )
    const evidence = path.join(folder, 'visual-evidence')
    const bytes = Buffer.from('synthetic image fixture; not a browser capture')
    const hash = createHash('sha256').update(bytes).digest('hex')
    for (const project of projects) {
      await fs.mkdir(path.join(evidence, project), { recursive: true })
      for (const state of states) {
        await fs.writeFile(path.join(evidence, project, state + '.png'), bytes)
        await fs.writeFile(
          path.join(evidence, project, state + '.json'),
          JSON.stringify({ screenshotSha256: hash }),
        )
      }
      for (const region of ['startup-brand', 'startup-book', 'startup-copy', 'startup-progress'])
        await fs.writeFile(path.join(evidence, project, 'loading-' + region + '.png'), bytes)
    }
    const run = async () => {
      await fs.writeFile(
        path.join(evidence, 'status.json'),
        JSON.stringify({
          automated: 'pass',
          initialDesignReview: 'pending',
          visualRegression: 'not-run',
        }),
      )
      let failed = false
      try {
        execFileSync(process.execPath, [path.join(root, 'scripts/visual-qa-report.mjs')], {
          cwd: folder,
          env: { ...process.env, VISUAL_PROFILE: 'startup' },
        })
      } catch {
        failed = true
      }
      return {
        failed,
        status: JSON.parse(await fs.readFile(path.join(evidence, 'status.json'), 'utf8')),
      }
    }
    let result = await run()
    assert.equal(result.failed, false)
    assert.equal(result.status.evidence, 'captured')
    assert.equal(result.status.initialDesignReview, 'pending')
    assert.equal(result.status.visualRegression, 'not-run')
    const html = await fs.readFile(path.join(evidence, 'comparison.html'), 'utf8')
    assert.match(html, /Owner source, original pixels/)
    assert.match(html, /Actual implementation element/)
    // Approval comes from the selected channel's explicit record, never capture success.
    await fs.mkdir(path.join(folder, 'tests/visual/baselines'), { recursive: true })
    await fs.copyFile(
      path.join(root, 'tests/visual/baselines/channels.json'),
      path.join(folder, 'tests/visual/baselines/channels.json'),
    )
    await fs.cp(
      path.join(root, 'tests/visual/baselines/channels/staging'),
      path.join(folder, 'tests/visual/baselines/channels/staging'),
      { recursive: true },
    )
    for (const project of projects)
      for (const state of states)
        await fs.writeFile(
          path.join(evidence, project, state + '.json'),
          JSON.stringify({ screenshotSha256: hash, candidate: { channel: 'staging' } }),
        )
    result = await run()
    assert.equal(result.failed, false)
    assert.equal(result.status.initialDesignReview, 'approved')
    assert.equal(result.status.approval.channel, 'staging')
    assert.equal(result.status.visualRegression, 'not-run')
    await fs.writeFile(path.join(evidence, 'stale-evidence.txt'), 'changed head')
    result = await run()
    assert.equal(result.failed, true)
    assert.equal(result.status.evidence, 'blocked')
    await fs.rm(path.join(evidence, 'stale-evidence.txt'))
    await fs.rm(path.join(evidence, 'chromium-1586-dark/loading-startup-copy.png'))
    result = await run()
    assert.equal(result.failed, true)
    assert.equal(result.status.evidence, 'blocked')
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
})
test('complete approved baseline checksum contract accepts unchanged bytes and rejects drift', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-approved-'))
  try {
    const files = {},
      bytes = Buffer.from('synthetic baseline fixture')
    for (const project of projects) {
      await fs.mkdir(path.join(folder, project), { recursive: true })
      for (const state of states) {
        const file = `${project}/${state}.png`
        files[file] = createHash('sha256').update(bytes).digest('hex')
        await fs.writeFile(path.join(folder, file), bytes)
      }
    }
    const manifest = {
      schema: 1,
      enabled: true,
      profile: 'startup',
      approval: {
        owner: 'HimanshuHD',
        reviewUrl: 'https://github.com/HimanshuHD/papertrail-reader/pull/176#issuecomment-1',
        sourceSha: 'a'.repeat(40),
        evidenceRun: '42',
        reviewedAt: '2026-10-13',
      },
      environment: {
        os: 'ubuntu-24.04',
        playwright: '1.63.0',
        browser: 'chromium',
        browserVersion: '153.0.8010.12',
        density: 1,
      },
      files,
    }
    await fs.writeFile(path.join(folder, 'approval.json'), JSON.stringify(manifest))
    assert.equal((await validateBaselines(folder)).enabled, true)
    await fs.writeFile(path.join(folder, 'chromium-375-light/loading.png'), 'changed')
    await assert.rejects(validateBaselines(folder), /checksum/)
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
})
test('manual workflow uses trusted dispatch ref, read-only permissions and static candidate; snapshot updating is disabled', async () => {
  const workflow = await fs.readFile('.github/workflows/visual-qa.yml', 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /refs\/heads\/staging/)
  assert.match(workflow, /ref: \$\{\{ inputs.tooling_sha \|\| github.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /npm ci --ignore-scripts/)
  assert.ok(
    !/pull_request_target|contents: write|pages: write|id-token: write|npm run build|source_ref/.test(
      workflow,
    ),
  )
  const config = await fs.readFile('playwright.visual.config.ts', 'utf8')
  assert.match(config, /updateSnapshots: 'none'/)
  const browser = await fs.readFile('.github/workflows/browser-e2e.yml', 'utf8')
  assert.match(browser, /if: matrix.shard == 1/)
  assert.match(browser, /VISUAL_ACCEPTANCE: 'true'/)
})

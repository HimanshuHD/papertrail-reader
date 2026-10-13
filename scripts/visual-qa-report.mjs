import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { validateBaselines } from './visual-baselines.mjs'
await fs.mkdir('visual-evidence', { recursive: true })
const readJSON = async (file) => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}
const status = (await readJSON('visual-evidence/status.json')) || {
  automated: 'not-run',
  evidence: 'blocked',
  initialDesignReview: 'pending',
  visualRegression: 'not-run',
  reason: 'Provenance verification or browser setup did not complete.',
}
const profile =
  process.env.VISUAL_PROFILE || (await readJSON('visual-plan.json'))?.profile || 'startup'
const states =
  profile === 'startup'
    ? ['loading', 'loading-reduced', 'ready', 'library-hidden', 'error', 'retry-ready']
    : ['ready', 'library-hidden']
const source = await fs.readFile('tests/visual/references/startup-owner.webp')
const sourceURL = 'data:image/webp;base64,' + source.toString('base64')
const reference = await readJSON('tests/visual/references/startup-owner.json')
if (createHash('sha256').update(source).digest('hex') !== reference.sha256)
  throw new Error('Source reference checksum mismatch')
const dimensions = { width: reference.width, height: reference.height }
const projects = [375, 1440, 1586].flatMap((width) =>
  ['light', 'dark'].map((theme) => `chromium-${width}-${theme}`),
)
const captures = [],
  missing = []
for (const project of projects)
  for (const state of states) {
    const file = `${project}/${state}.png`
    try {
      const bytes = await fs.readFile(path.join('visual-evidence', file))
      const identity = await readJSON(path.join('visual-evidence', `${project}/${state}.json`))
      if (
        !identity ||
        identity.screenshotSha256 !== createHash('sha256').update(bytes).digest('hex')
      )
        throw Error('Missing identity')
      captures.push({ file, state, project, identity })
    } catch {
      missing.push(file)
    }
  }
if (profile === 'startup')
  for (const project of projects) {
    for (const region of ['startup-brand', 'startup-book', 'startup-copy', 'startup-progress']) {
      const file = `${project}/loading-${region}.png`
      try {
        await fs.access(path.join('visual-evidence', file))
      } catch {
        missing.push(file)
      }
    }
  }
let stale = false
try {
  await fs.access('visual-evidence/stale-evidence.txt')
  stale = true
} catch {
  /* no stale marker */
}
status.evidence = missing.length || stale ? 'blocked' : 'captured'
status.missing = missing
status.stale = stale
// Only an explicit reviewed baseline record reports owner approval; browser success cannot.
let approval
try {
  approval = await validateBaselines()
} catch {
  /* Unavailable or invalid approval stays pending. */
}
status.initialDesignReview = approval?.enabled && approval?.approval ? 'approved' : 'pending'
status.approval = approval?.enabled ? approval.approval : null
if (stale)
  status.reason =
    'PR identity changed; evidence is historical and cannot accept the current candidate.'
await fs.writeFile('visual-evidence/status.json', JSON.stringify(status, null, 2))
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const regions = [
  { name: 'startup-brand', crop: [710, 65, 166, 90] },
  { name: 'startup-book', crop: [490, 215, 600, 375] },
  { name: 'startup-copy', crop: [510, 620, 570, 100] },
  { name: 'startup-progress', crop: [540, 735, 510, 135] },
]
let html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>PaperTrail Design QA evidence</title><style>body{font:16px system-ui;margin:24px;background:#eee;color:#111}section{margin:32px 0}.pair{display:flex;gap:24px;align-items:flex-start;overflow:auto}figure{margin:0}figcaption{max-width:750px;padding:10px 0}img{max-width:none}pre{white-space:pre-wrap}.crop{background-image:url(${sourceURL});background-repeat:no-repeat;flex:none}</style><h1>Design QA comparison evidence</h1><pre>${escape(JSON.stringify(status, null, 2))}</pre><p>Source: owner mock, ${dimensions.width} × ${dimensions.height} pixels. Density interpreted as 1 for the 1586 × 992 CSS viewport; owner must verify that assumption. Source shows illustrative Reader stage/62% progress. Captured loading holds bootstrap at Library with honest indeterminate progress. These state differences require manual classification. Mobile and light-mode mocks are not supplied; those captures support responsive/state review, not strict source fidelity claims.</p>`
for (const capture of captures) {
  html += `<section><h2>${escape(capture.project + ' / ' + capture.state)}</h2><pre>${escape(JSON.stringify(capture.identity, null, 2))}</pre>`
  if (capture.state === 'loading' && capture.project === 'chromium-1586-dark') {
    html += `<div class="pair"><figure><img src="${sourceURL}" width="1586" height="992"><figcaption>Owner source, original pixels</figcaption></figure><figure><img src="${escape(capture.file)}"><figcaption>Browser implementation, same CSS viewport and density</figcaption></figure></div>`
    for (const region of regions) {
      const [x, y, width, height] = region.crop
      html += `<h3>${region.name}</h3><div class="pair"><figure><div class="crop" style="width:${width}px;height:${height}px;background-position:-${x}px -${y}px"></div><figcaption>Source region [${region.crop.join(', ')}], original scale</figcaption></figure><figure><img src="${escape(capture.project + '/loading-' + region.name + '.png')}"><figcaption>Actual implementation element; original scale, element dimensions may differ</figcaption></figure></div>`
    }
  } else html += `<img src="${escape(capture.file)}" style="max-width:100%">`
  html += '</section>'
}
html += '</html>'
await fs.writeFile('visual-evidence/comparison.html', html)
const markdown = `# Design QA evidence\n\n- Automated browser/assertion checks: **${status.automated}**\n- Evidence availability: **${status.evidence}**\n- Initial design review: **${status.initialDesignReview}**\n- Visual regression: **${status.visualRegression}**\n\n${status.reason}\n\nOpen comparison.html from the downloaded evidence folder; keep its relative screenshot files together. Source: tests/visual/references/startup-owner.webp (${dimensions.width} × ${dimensions.height}); browser identity and exact candidate hashes are recorded per capture and in candidate.json. Full-view and focused pairs appear for 1586-dark/loading only. Other states lack an owner mock. No automatic design-fidelity verdict is issued.\n\n## Required owner review\n\nEvaluate typography, spacing/layout, colors, image fidelity, and copy. Record each P0/P1/P2 finding with location, both evidence paths, impact, fix and disposition. Fix in the feature branch and recapture the same viewport/theme/route/content/state/density. Preserve previous run links and post-fix evidence. Accept only after all actionable P0/P1/P2 findings are resolved and source-state differences are classified.\n\n## Comparison history\n\nRun ${process.env.GITHUB_RUN_ID || 'local'} attempt ${process.env.GITHUB_RUN_ATTEMPT || 'local'}; tooling ${process.env.GITHUB_SHA || 'local'}. This capture appends evidence through a unique run artifact; it does not supersede or delete earlier review history. Owner approval and findings belong in the feature PR and reviewed design record.\n\nMissing captures: ${missing.join(', ') || 'none'}.\n`
await fs.writeFile('visual-evidence/design-qa.md', markdown)
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
if (status.evidence === 'blocked' && status.automated !== 'not-run') process.exitCode = 1

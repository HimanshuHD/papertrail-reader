export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const display = (value) => {
  if (value === undefined || value === null) return 'Not recorded'
  if (Array.isArray(value)) return value.length ? value.map(display).join('\n') : 'None'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const rows = (items) =>
  `<dl>${items.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(display(value))}</dd></div>`).join('')}</dl>`

export function evidenceDetails(data, kind) {
  if (kind === 'status')
    return rows([
      ['Browser assertions', data.automated],
      ['Evidence availability', data.evidence],
      ['Owner design review', data.initialDesignReview],
      ['Visual regression', data.visualRegression],
      ['Reason / next action', data.reason || 'No additional reason recorded'],
      ['Stale evidence', data.stale],
      ['Missing captures', data.missing],
      ['Owner approval', data.approval],
    ])
  const candidate = data.candidate || data
  return rows([
    ['State', data.state],
    ['Project', data.project],
    [
      'Viewport',
      data.viewport ? `${data.viewport.width} × ${data.viewport.height} CSS px` : undefined,
    ],
    ['Pixel density', data.density],
    ['Theme', data.theme],
    ['Route', data.route],
    ['Reduced motion', data.reducedMotion],
    ['Sprite frame', data.spriteFrame],
    ['Progress', data.progress == null ? undefined : `${data.progress}%`],
    ['Progress mode', data.progressMode],
    ['Capture clock', data.captureClock],
    ['Browser version', data.browser],
    ['OS / runner', [data.os, data.runner].filter(Boolean).join(' / ') || undefined],
    ['Playwright version', data.playwright],
    ['Capture run / attempt', `${data.run || 'Not recorded'} / ${data.attempt || 'Not recorded'}`],
    ['Tooling SHA', data.toolingSha],
    ['Candidate PR', candidate.pr],
    ['Candidate channel', candidate.channel],
    ['Candidate run', candidate.runId],
    ['Head SHA', candidate.headSha],
    ['Base SHA', candidate.baseSha],
    ['Source SHA', candidate.sha],
    ['Source tree', candidate.tree],
    ['Base path', candidate.basePath],
    ['Screenshot SHA-256', data.screenshotSha256],
  ])
}

export function testCaseDetails(spec, test) {
  const results = test.results || []
  return rows([
    ['Test case', spec.title],
    ['Location', `${spec.file || 'Unknown'}:${spec.line || '?'}`],
    ['Project', test.projectName],
    ['Outcome', test.status],
    ['Expected status', test.expectedStatus],
    ['Attempts', results.length],
    ...results.flatMap((result, index) => [
      [`Attempt ${index + 1} status`, result.status],
      [`Attempt ${index + 1} duration`, `${result.duration ?? 0} ms`],
      [`Attempt ${index + 1} retry`, result.retry],
      [
        `Attempt ${index + 1} errors`,
        (result.errors || []).map((error) => error.message || error.value || 'Unspecified error'),
      ],
      [
        `Attempt ${index + 1} attachments`,
        (result.attachments || []).map(
          (a) => `${a.name} (${a.contentType})${a.path ? ': ' + a.path : ''}`,
        ),
      ],
    ]),
  ])
}

export function jsonTabs(id, data, details) {
  return `<div class="json-tabs"><input type="radio" name="${id}" id="${id}-json"><label for="${id}-json">JSON</label><input type="radio" name="${id}" id="${id}-details" checked><label for="${id}-details">Details</label><div class="json-panel"><pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre></div><div class="details-panel">${details}</div></div>`
}

export const detailsCSS = `.json-tabs{display:flex;flex-wrap:wrap;background:#fff;border:1px solid #ccd2da;border-radius:8px;padding:16px;gap:8px}.json-tabs>input{position:absolute;opacity:0;width:1px;height:1px}.json-tabs>label{cursor:pointer;padding:8px 18px;border:1px solid #aab4c2;border-radius:5px}.json-tabs>input:checked+label{background:#173c55;color:white}.json-tabs>input:focus-visible+label{outline:3px solid #367bad;outline-offset:2px}.json-panel,.details-panel{display:none;width:100%;min-width:0}.json-tabs>input[id$="-json"]:checked~.json-panel,.json-tabs>input[id$="-details"]:checked~.details-panel{display:block}dl{margin:12px 0}dl>div{display:grid;grid-template-columns:minmax(130px,220px) minmax(0,1fr);gap:16px;padding:9px 0;border-bottom:1px solid #eee}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}pre{overflow-wrap:anywhere;white-space:pre-wrap}@media(max-width:600px){dl>div{grid-template-columns:1fr;gap:4px}}`

export function testReportDetails(report, count) {
  return rows([
    ['Recorded test cases', count],
    ['Passed (expected)', report.stats?.expected],
    ['Failed (unexpected)', report.stats?.unexpected],
    ['Flaky', report.stats?.flaky],
    ['Skipped', report.stats?.skipped],
    ['Started at', report.stats?.startTime],
    ['Duration', report.stats?.duration == null ? undefined : `${report.stats.duration} ms`],
    [
      'Run errors',
      (report.errors || []).map((error) => error.message || error.value || 'Unspecified error'),
    ],
  ])
}

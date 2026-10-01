export function affectsWebsite(paths) {
  return paths.some(p => !(
    p.startsWith('docs/') || /^(README|CONTRIBUTING|CHANGELOG|LICENSE)(\.[^/]+)?$/i.test(p) ||
    p === '.gitignore' || p.startsWith('.github/ISSUE_TEMPLATE/') || p === '.github/PULL_REQUEST_TEMPLATE.md'
  ))
}
export function previewDecision({ manual, state, currentSha, buildSha, sameRepo, target }) {
  if (!sameRepo || target !== 'main' || currentSha !== buildSha) return 'skip'
  if (manual && state !== 'open') throw new Error('Manual preview requires an open PR')
  if (state !== 'open') return 'retire'
  return manual ? 'preview' : 'skip'
}

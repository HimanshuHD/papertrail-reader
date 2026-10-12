export function referencedIssues(body = '') {
  const refs = new Set()
  for (const match of body.matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi))
    refs.add(Number(match[1]))
  for (const line of body.split('\n')) {
    if (!/^\s*(?:refs?|related|issues?|parent)\b/i.test(line)) continue
    for (const match of line.matchAll(/#(\d+)/g)) refs.add(Number(match[1]))
  }
  return refs
}

export async function reconcileMergedIssues({ github, owner, repo, pr }) {
  if (
    !pr?.merged ||
    !['main', 'staging'].includes(pr.base?.ref) ||
    pr.head?.repo?.full_name !== owner + '/' + repo
  )
    return { updated: 0 }
  const branch = pr.base.ref
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  })
  const byNumber = new Map(issues.filter((i) => !i.pull_request).map((i) => [i.number, i]))
  const refs = referencedIssues(pr.body)
  let updated = 0
  for (const issue of byNumber.values()) {
    let body = issue.body || ''
    if (refs.has(issue.number)) {
      const evidence =
        'PR #' +
        pr.number +
        ' merged to ' +
        branch +
        '; merge commit `' +
        pr.merge_commit_sha +
        '`.'
      if (!body.includes(evidence)) {
        body +=
          '\n\n## ' + (branch === 'staging' ? 'Staging integration' : 'Main merge') + ' evidence\n'
        body += evidence + '\n'
        if (branch === 'staging')
          body +=
            'Implementation integrated; browser/deployment acceptance and production release remain separately tracked. This merge does not complete this issue.\n'
      }
      body = body.replace(
        '- [ ] PR merged to ' + branch + '.',
        '- [x] PR merged to ' + branch + '.',
      )
      if (
        branch === 'main' &&
        issue.state === 'closed' &&
        (!issue.state_reason || issue.state_reason === 'completed')
      )
        body = body.replace(
          /Status: (?:Backlog|In progress|In review|Blocked)/g,
          'Status: Completed',
        )
    }
    if (issue.state === 'open') {
      body = body.replace(/^- \[[ x]\] #(\d+)\s*$/gm, (line, number) => {
        const child = byNumber.get(Number(number))
        if (!child) return line
        const complete =
          child.state === 'closed' && (!child.state_reason || child.state_reason === 'completed')
        return '- [' + (complete ? 'x' : ' ') + '] #' + number
      })
    }
    if (body !== (issue.body || '')) {
      await github.rest.issues.update({ owner, repo, issue_number: issue.number, body })
      updated++
    }
  }
  return { updated }
}

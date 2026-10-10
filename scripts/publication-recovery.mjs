import { eligibleMainBuild } from './deploy-policy.mjs'

// Only completed, successful frontend jobs are recoverable, even if their publisher was cancelled.
export async function recoverPublication({ github, owner, repo }) {
  const readState = async (path) => {
    try {
      const { data } = await github.rest.repos.getContent({ owner, repo, path, ref: 'pages-state' })
      return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
    } catch (error) {
      if (error.status !== 404) throw error
      return null
    }
  }
  const state = await readState('.deployment-state.json')
  const receipt = await readState('.publication-receipt.json')
  const retirePRs = []
  for (const [number, preview] of Object.entries(state?.previews || {})) {
    if (preview.status !== 'active') continue
    const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: Number(number) })
    if (pr.state === 'closed') retirePRs.push(Number(number))
  }
  const { data: main } = await github.rest.repos.getBranch({ owner, repo, branch: 'main' })
  let selected
  // Bounded lookback: old/expired builds require a fresh CI run, never unverified content.
  for (let page = 1; page <= 3 && !selected; page++) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 'ci.yml',
      branch: 'main',
      event: 'push',
      status: 'completed',
      per_page: 100,
      page,
    })
    for (const run of data.workflow_runs) {
      if (
        run.head_repository?.full_name !== owner + '/' + repo ||
        run.event !== 'push' ||
        run.head_branch !== 'main'
      )
        continue
      if (state?.production && Number(run.id) < Number(state.production.runId)) continue
      const comparison =
        run.head_sha === main.commit.sha
          ? null
          : (
              await github.rest.repos.compareCommits({
                owner,
                repo,
                base: run.head_sha,
                head: main.commit.sha,
              })
            ).data
      if (
        !eligibleMainBuild({
          buildSha: run.head_sha,
          mainSha: main.commit.sha,
          status: comparison?.status,
          files: comparison?.files,
        })
      )
        continue
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
        owner,
        repo,
        run_id: run.id,
        filter: 'latest',
        per_page: 100,
      })
      if (
        !jobs.some(
          (job) => job.name === 'Validate and build website' && job.conclusion === 'success',
        )
      )
        continue
      const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
        owner,
        repo,
        run_id: run.id,
        per_page: 100,
      })
      if (!artifacts.some((artifact) => artifact.name === 'web-build' && !artifact.expired))
        continue
      selected = run
      break
    }
    if (data.workflow_runs.length < 100) break
  }
  const acknowledged = state && JSON.stringify(state) === JSON.stringify(receipt)
  let changed = selected && selected.head_sha !== state?.production?.sha
  if (changed && state?.production?.sha) {
    const { data: comparison } = await github.rest.repos.compareCommits({
      owner,
      repo,
      base: state.production.sha,
      head: selected.head_sha,
    })
    // Do not turn a documentation-only merge into a scheduled production deployment.
    changed = !eligibleMainBuild({
      buildSha: state.production.sha,
      mainSha: selected.head_sha,
      status: comparison.status,
      files: comparison.files,
    })
  }
  if (changed)
    return {
      retirePRs,
      reason: 'Recover latest trusted main frontend build',
      outputs: { kind: 'production', run_id: String(selected.id), sha: selected.head_sha, pr: '' },
    }
  if (state && (!acknowledged || retirePRs.length))
    return {
      retirePRs,
      reason: 'Republish saved aggregate or retire closed previews',
      outputs: { kind: 'reconcile', run_id: '', sha: '', pr: '' },
    }
  return {
    retirePRs,
    reason: selected
      ? 'Publication is already acknowledged'
      : 'No recoverable build; rerun main CI if an artifact expired',
    outputs: {
      skip: 'true',
      reason: selected ? 'Publication is already acknowledged' : 'No recoverable build',
    },
  }
}

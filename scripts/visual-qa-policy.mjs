import { selectCandidate, previewEligible } from './delivery-policy.mjs'
import { verifyCandidate } from './candidate-artifact.mjs'

export async function assertVisualPR({ github, owner, repo, prNumber, plan }) {
  const repository = `${owner}/${repo}`
  const pr = (await github.rest.pulls.get({ owner, repo, pull_number: Number(prNumber) })).data
  if (!previewEligible(pr, repository))
    throw new Error(
      'Visual QA requires an open ready same-repository staging, release or hotfix PR',
    )
  const branch = (await github.rest.repos.getBranch({ owner, repo, branch: pr.base.ref })).data
  if (pr.base.sha !== branch.commit.sha) throw new Error('PR base is stale')
  const comparison = (
    await github.rest.repos.compareCommits({ owner, repo, base: pr.base.sha, head: pr.head.sha })
  ).data
  if (comparison.merge_base_commit.sha !== pr.base.sha)
    throw new Error('Update the PR branch from its current base before Visual QA')
  if (!pr.merge_commit_sha) throw new Error('Current PR merge tree is unavailable')
  const merge = (await github.rest.git.getCommit({ owner, repo, commit_sha: pr.merge_commit_sha }))
    .data
  if (
    merge.parents?.length !== 2 ||
    merge.parents[0].sha !== pr.base.sha ||
    merge.parents[1].sha !== pr.head.sha
  )
    throw new Error('PR merge identity is stale')
  if (
    plan &&
    (plan.headSha !== pr.head.sha ||
      plan.baseSha !== pr.base.sha ||
      plan.tree !== merge.tree.sha ||
      plan.sourceSha !== pr.merge_commit_sha ||
      plan.pr !== String(pr.number) ||
      plan.branch !== pr.base.ref)
  )
    throw new Error('PR changed during Visual QA; recapture the current candidate')
  return { pr, merge }
}

export async function selectVisualCandidate(options) {
  if (!/^[1-9]\d*$/.test(String(options.prNumber))) throw new Error('Invalid PR number')
  const profile = options.profile || 'auto'
  if (!['auto', 'startup', 'shell'].includes(profile)) throw new Error('Invalid Visual QA profile')
  const { pr, merge } = await assertVisualPR(options)
  const channel = options.channel || 'preview'
  const destination = pr.base.ref === 'main' ? 'production' : 'staging'
  if (!['preview', destination].includes(channel))
    throw new Error('Selected channel is not available in this PR candidate')
  const candidate = await selectCandidate({
    ...options,
    branch: pr.base.ref,
    candidateAcceptance: true,
  })
  const runId = candidate.runId
  const args = { owner: options.owner, repo: options.repo, run_id: Number(runId), per_page: 100 }
  const run = (await options.github.rest.actions.getWorkflowRun(args)).data
  if (
    run.event !== 'pull_request' ||
    run.path !== '.github/workflows/ci.yml' ||
    run.status !== 'completed' ||
    run.head_sha !== pr.head.sha ||
    run.head_branch !== pr.head.ref ||
    run.head_repository?.full_name !== `${options.owner}/${options.repo}` ||
    !run.pull_requests?.some((p) => p.number === pr.number)
  )
    throw new Error('Candidate workflow/source/PR identity mismatch')
  const jobs = await options.github.paginate(options.github.rest.actions.listJobsForWorkflowRun, {
    ...args,
    filter: 'latest',
  })
  if (!jobs.some((job) => job.name === 'Candidate validation' && job.conclusion === 'success'))
    throw new Error('Successful current Candidate validation is required')
  if (
    !jobs.some((job) => job.name === 'Validate and build website' && job.conclusion === 'success')
  )
    throw new Error('Successful candidate frontend build is required')
  const artifacts = await options.github.paginate(
    options.github.rest.actions.listWorkflowRunArtifacts,
    args,
  )
  if (!artifacts.some((a) => a.name === 'candidate-build' && !a.expired))
    throw new Error('Current candidate artifact is missing or expired')
  const plan = {
    channel,
    branch: pr.base.ref,
    sourceSha: pr.merge_commit_sha,
    tree: merge.tree.sha,
    headSha: pr.head.sha,
    pr: String(pr.number),
    runId,
    baseSha: pr.base.sha,
    profile,
    acceptance: 'completed-candidate-gate-passed',
  }
  await assertVisualPR({ ...options, plan })
  return plan
}

export async function verifyVisualArtifact(folder, plan, base = '/papertrail-reader/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid site base path')
  const destination = plan.branch === 'main' ? 'production' : 'staging'
  if (!['preview', destination].includes(plan.channel)) throw new Error('Invalid artifact channel')
  const basePath =
    plan.channel === 'preview'
      ? `${base}preview/pr-${plan.pr}/`
      : plan.channel === 'staging'
        ? `${base}staging/`
        : base
  const build = await verifyCandidate(folder, { ...plan, basePath })
  if (build.sha !== plan.sourceSha || build.baseSha !== plan.baseSha)
    throw new Error('Artifact source/base identity mismatch')
  return build
}

export function visualProfile(profile, html) {
  if (!['auto', 'startup', 'shell'].includes(profile)) throw new Error('Invalid Visual QA profile')
  return profile === 'auto'
    ? /\bid\s*=\s*(["']?)startup-loading\1(?=[\s>])/.test(html)
      ? 'startup'
      : 'shell'
    : profile
}

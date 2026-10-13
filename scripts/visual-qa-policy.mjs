import { selectCandidate, previewEligible } from './delivery-policy.mjs'
import { verifyCandidate } from './candidate-artifact.mjs'

export async function assertVisualPR({ github, owner, repo, prNumber, plan }) {
  const repository = `${owner}/${repo}`
  const pr = (await github.rest.pulls.get({ owner, repo, pull_number: Number(prNumber) })).data
  const branch = (await github.rest.repos.getBranch({ owner, repo, branch: 'staging' })).data
  if (!previewEligible(pr, repository) || pr.base.ref !== 'staging')
    throw new Error('Visual QA requires an open ready same-repository staging PR')
  if (pr.base.sha !== branch.commit.sha) throw new Error('PR base is stale')
  const comparison = (
    await github.rest.repos.compareCommits({ owner, repo, base: pr.base.sha, head: pr.head.sha })
  ).data
  if (comparison.merge_base_commit.sha !== pr.base.sha)
    throw new Error('Update the PR branch from current staging before Visual QA')
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
      plan.pr !== String(pr.number))
  )
    throw new Error('PR changed during Visual QA; recapture the current candidate')
  return { pr, merge }
}

export async function selectVisualCandidate(options) {
  if (!/^[1-9]\d*$/.test(String(options.prNumber))) throw new Error('Invalid PR number')
  const { pr, merge } = await assertVisualPR(options)
  const candidate = await selectCandidate({ ...options, branch: 'staging' })
  const run = (
    await options.github.rest.actions.getWorkflowRun({
      owner: options.owner,
      repo: options.repo,
      run_id: Number(candidate.runId),
    })
  ).data
  if (
    run.event !== 'pull_request' ||
    run.path !== '.github/workflows/ci.yml' ||
    run.conclusion !== 'success' ||
    run.head_sha !== pr.head.sha ||
    run.head_branch !== pr.head.ref ||
    run.head_repository?.full_name !== `${options.owner}/${options.repo}` ||
    !run.pull_requests?.some((p) => p.number === pr.number)
  )
    throw new Error('Candidate workflow/source/PR identity mismatch')
  const jobs = await options.github.paginate(options.github.rest.actions.listJobsForWorkflowRun, {
    owner: options.owner,
    repo: options.repo,
    run_id: run.id,
    filter: 'latest',
    per_page: 100,
  })
  if (!jobs.some((job) => job.name === 'Candidate validation' && job.conclusion === 'success'))
    throw new Error('Successful current Candidate validation is required')
  const plan = {
    ...candidate,
    sourceSha: pr.merge_commit_sha,
    tree: merge.tree.sha,
    profile: options.profile || 'startup',
  }
  await assertVisualPR({ ...options, plan })
  return plan
}

export async function verifyVisualArtifact(folder, plan, base = '/papertrail-reader/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid site base path')
  const build = await verifyCandidate(folder, {
    ...plan,
    channel: 'preview',
    basePath: `${base}preview/pr-${plan.pr}/`,
  })
  if (build.sha !== plan.sourceSha || build.baseSha !== plan.baseSha)
    throw new Error('Artifact source/base identity mismatch')
  return build
}

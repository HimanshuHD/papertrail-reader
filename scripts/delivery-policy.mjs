import { eligibleMainBuild } from './deploy-policy.mjs'

export function previewEligible(pr, repository) {
  return (
    pr.state === 'open' &&
    !pr.draft &&
    pr.head.repo?.full_name === repository &&
    (pr.base.ref === 'staging' ||
      (pr.base.ref === 'main' && /^(release|hotfix)\//.test(pr.head.ref)))
  )
}
export function branchChannel(branch) {
  if (branch === 'main') return 'production'
  if (branch === 'staging') return 'staging'
  throw new Error('Unsupported deployment branch')
}
export async function readPublished(github, owner, repo, file = '.deployment-state.json') {
  try {
    const { data } = await github.rest.repos.getContent({
      owner,
      repo,
      path: file,
      ref: 'pages-state',
    })
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
  } catch (error) {
    if (error.status !== 404) throw error
    return null
  }
}

export async function selectCandidate({
  github,
  owner,
  repo,
  branch,
  prNumber,
  sourceSha,
  manualRun,
  candidateAcceptance = false,
  excludeRun,
}) {
  const repository = owner + '/' + repo
  const { data: target } = await github.rest.repos.getBranch({
    owner,
    repo,
    branch,
  })
  if (sourceSha && sourceSha !== target.commit.sha)
    return { skip: true, reason: 'Superseded branch event' }
  const channel = prNumber ? 'preview' : branchChannel(branch)
  const state = await readPublished(github, owner, repo)
  // A local synchronization merge has no PR candidate. Skip only when staging
  // remains an exact descendant of its own successfully published source tree.
  if (branch === 'staging' && !prNumber && !manualRun && state?.staging) {
    if (state.rollbackHold?.staging === target.commit.sha)
      return {
        skip: true,
        reason: 'Rollback hold: reconcile source before automatic promotion',
      }
    const publishedSha = state.staging.sourceSha || state.staging.sha
    const receipt = await readPublished(github, owner, repo, '.publication-receipt.json')
    if (
      publishedSha &&
      receipt?.staging &&
      JSON.stringify(receipt.staging) === JSON.stringify(state.staging)
    ) {
      const [{ data: published }, { data: comparison }] = await Promise.all([
        github.rest.git.getCommit({ owner, repo, commit_sha: publishedSha }),
        github.rest.repos.compareCommits({
          owner,
          repo,
          base: publishedSha,
          head: target.commit.sha,
        }),
      ])
      if (
        ['ahead', 'identical'].includes(comparison.status) &&
        published.tree?.sha &&
        published.tree.sha === target.commit.commit.tree.sha
      )
        return {
          skip: true,
          reason: 'History-only staging synchronization; published tree unchanged',
        }
    }
  }
  let pr
  let candidateSha = target.commit.sha
  let candidateTree = prNumber ? null : target.commit.commit.tree.sha
  if (prNumber) {
    pr = (
      await github.rest.pulls.get({
        owner,
        repo,
        pull_number: Number(prNumber),
      })
    ).data
    if (!previewEligible(pr, repository) || pr.base.ref !== branch)
      throw new Error('Choose a ready same-repository staging, release or hotfix PR')
  } else if (!manualRun) {
    // A documentation PR may have been built against an older base. Its artifact
    // cannot stand in for intervening application/test changes. Walk only verified
    // docs-only first-parent merges to the most recent website-changing candidate.
    for (let depth = 0; ; depth++) {
      if (depth === 20)
        throw new Error('Documentation ancestry limit; run manual Frontend CI recovery')
      const associated = await github.paginate(
        github.rest.repos.listPullRequestsAssociatedWithCommit,
        { owner, repo, commit_sha: candidateSha, per_page: 100 },
      )
      pr = associated.find(
        (p) =>
          p.merged_at &&
          p.base.ref === branch &&
          p.merge_commit_sha === candidateSha &&
          p.head.repo?.full_name === repository,
      )
      if (!pr)
        throw new Error('No validated merged PR for branch head; run manual Frontend CI recovery')
      if (branch !== 'staging') break
      const { data: commit } = await github.rest.git.getCommit({
        owner,
        repo,
        commit_sha: candidateSha,
      })
      const parent = commit.parents?.[0]?.sha
      if (!parent) break
      const { data: comparison } = await github.rest.repos.compareCommits({
        owner,
        repo,
        base: parent,
        head: target.commit.sha,
      })
      if (
        !eligibleMainBuild({
          buildSha: parent,
          mainSha: target.commit.sha,
          status: comparison.status,
          files: comparison.files,
        })
      )
        break
      const { data: predecessor } = await github.rest.git.getCommit({
        owner,
        repo,
        commit_sha: parent,
      })
      candidateSha = parent
      candidateTree = predecessor.tree.sha
    }
    if (branch === 'main' && !/^(release|hotfix)\//.test(pr.head.ref))
      throw new Error('Production requires a release or hotfix PR')
  }
  if (!prNumber && !manualRun && state?.[channel]) {
    const previous = state[channel]
    if (state.rollbackHold?.[channel] === target.commit.sha)
      return {
        skip: true,
        reason: 'Rollback hold: reconcile source before automatic promotion',
      }
    if (previous.sourceSha === target.commit.sha)
      return {
        skip: true,
        reason: 'Current branch content already saved; receipt recovery runs separately',
      }
    const comparison = (
      await github.rest.repos.compareCommits({
        owner,
        repo,
        base: previous.sourceSha || previous.sha,
        head: target.commit.sha,
      })
    ).data
    if (
      eligibleMainBuild({
        buildSha: previous.sourceSha || previous.sha,
        mainSha: target.commit.sha,
        status: comparison.status,
        files: comparison.files,
      })
    )
      return {
        skip: true,
        reason: 'Documentation-only descendant; website unchanged',
      }
  }
  let runs
  if (manualRun) {
    const run = (
      await github.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: Number(manualRun),
      })
    ).data
    if (
      run.event !== 'workflow_dispatch' ||
      run.head_branch !== branch ||
      run.head_sha !== target.commit.sha ||
      !run.path?.endsWith('/ci.yml')
    )
      throw new Error('Invalid manual recovery run')
    runs = [run]
  } else {
    runs = (
      await github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: 'ci.yml',
        event: 'pull_request',
        head_sha: pr.head.sha,
        ...(candidateAcceptance ? {} : { status: 'success' }),
        per_page: 100,
      })
    ).data.workflow_runs
  }
  let pending = false
  for (const run of runs) {
    if (candidateAcceptance) {
      if (
        String(run.id) === String(excludeRun) ||
        run.event !== 'pull_request' ||
        run.path !== '.github/workflows/ci.yml' ||
        run.head_sha !== pr.head.sha ||
        run.head_branch !== pr.head.ref ||
        run.head_repository?.full_name !== repository ||
        !run.pull_requests?.some((item) => item.number === pr.number)
      )
        continue
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
        owner,
        repo,
        run_id: run.id,
        per_page: 100,
        filter: 'latest',
      })
      const frontend = jobs.find((job) => job.name === 'Validate and build website')
      const gate = jobs.find((job) => job.name === 'Candidate validation')
      if (frontend?.conclusion !== 'success' || gate?.conclusion !== 'success') {
        // Other metadata-only runs have a skipped frontend and cannot create a candidate.
        if (
          ['queued', 'in_progress', 'waiting', 'pending'].includes(run.status) &&
          (!frontend ||
            ['queued', 'in_progress'].includes(frontend.status) ||
            frontend.conclusion === 'success') &&
          (!gate || ['queued', 'in_progress'].includes(gate.status))
        )
          pending = true
        continue
      }
      if (!['in_progress', 'completed'].includes(run.status)) continue
    } else if (run.conclusion !== 'success' || run.head_repository?.full_name !== repository)
      continue
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
      owner,
      repo,
      run_id: run.id,
      per_page: 100,
    })
    if (!artifacts.some((a) => a.name === 'candidate-build' && !a.expired)) continue
    const tree = prNumber
      ? (
          await github.rest.git.getCommit({
            owner,
            repo,
            commit_sha: pr.merge_commit_sha,
          })
        ).data.tree.sha
      : candidateTree
    return {
      channel,
      branch,
      sourceSha: prNumber ? pr.head.sha : target.commit.sha,
      candidateSourceSha: prNumber ? pr.merge_commit_sha : candidateSha,
      tree,
      headSha: pr?.head.sha || target.commit.sha,
      pr: String(pr?.number || ''),
      runId: String(run.id),
      baseSha: prNumber ? pr.base.sha : '',
      retired: false,
    }
  }
  throw Object.assign(
    new Error(
      'No successful current candidate artifact; run fresh CI, including required browser acceptance',
    ),
    {
      code: candidateAcceptance && !pending ? 'CANDIDATE_UNAVAILABLE' : 'CANDIDATE_NOT_READY',
    },
  )
}

export async function waitForCandidate(
  options,
  {
    attempts = 61,
    intervalMs = 15000,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onWait = () => {},
  } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pr = (
      await options.github.rest.pulls.get({
        owner: options.owner,
        repo: options.repo,
        pull_number: Number(options.prNumber),
      })
    ).data
    if (pr.head.sha !== options.expectedHead || pr.base.sha !== options.expectedBase)
      throw new Error('PR head or base changed while waiting; use current candidate validation')
    try {
      return await selectCandidate(options)
    } catch (error) {
      if (error.code !== 'CANDIDATE_NOT_READY' || attempt === attempts) throw error
      onWait(attempt)
      await pause(intervalMs)
    }
  }
}

export async function closedPreviews(github, owner, repo, state) {
  const retired = []
  for (const [number, preview] of Object.entries(state?.previews || {})) {
    if (preview.status !== 'active') continue
    const { data: pr } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: Number(number),
    })
    if (pr.state === 'closed') retired.push(Number(number))
  }
  return retired
}

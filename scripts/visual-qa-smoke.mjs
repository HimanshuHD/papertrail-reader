/** A QA-only manual CI completion is evidence, never a publication candidate. */
export async function visualQaOnlyRun({ github, owner, repo, runId }) {
  const args = { owner, repo, run_id: Number(runId), per_page: 100 }
  const [jobs, artifacts] = await Promise.all([
    github.paginate(github.rest.actions.listJobsForWorkflowRun, { ...args, filter: 'latest' }),
    github.paginate(github.rest.actions.listWorkflowRunArtifacts, args),
  ])
  return (
    jobs.some(
      (job) => job.name.startsWith('Visual QA smoke (PR #176) / ') && job.conclusion === 'success',
    ) &&
    !jobs.some(
      (job) =>
        ['Candidate validation', 'Validate and build website'].includes(job.name) &&
        job.conclusion === 'success',
    ) &&
    !artifacts.some((artifact) => artifact.name === 'candidate-build' && !artifact.expired)
  )
}

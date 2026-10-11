import fs from 'node:fs'
import { assemble } from './assemble-pages.mjs'
import { verifyCandidate } from './candidate-artifact.mjs'
const kind = process.env.KIND
const retirePRs = JSON.parse(fs.readFileSync('retired-prs.json', 'utf8'))
const previewNotices = JSON.parse(fs.readFileSync('preview-notices.json', 'utf8'))
if (kind === 'reconcile') await assemble({ site: '_site', kind, retirePRs, previewNotices })
else {
  const plan = JSON.parse(fs.readFileSync('promotion-plan.json', 'utf8'))
  let build, artifact
  if (kind === 'rollback') {
    artifact = `_site/.deployment-archives/${plan.channel}/${plan.archiveId}`
    build = JSON.parse(fs.readFileSync(artifact + '/build.json', 'utf8'))
    await verifyCandidate(artifact, {
      ...build,
      channel: plan.channel,
      tree: plan.tree,
      runId: plan.runId,
    })
  } else {
    artifact = `incoming/${plan.channel}`
    build = JSON.parse(fs.readFileSync('verified-build.json', 'utf8'))
  }
  await assemble({
    site: '_site',
    artifact,
    kind: plan.channel,
    pr: plan.pr,
    branch: plan.branch,
    sha: build.sha,
    runId: build.runId,
    tree: build.tree,
    version: build.version,
    sourceSha: plan.sourceSha,
    holdSha: plan.holdSha,
    rollback: kind === 'rollback',
    archiveId: plan.archiveId,
    retirePRs,
    previewNotices,
  })
}

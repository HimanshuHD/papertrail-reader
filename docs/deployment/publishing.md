# App deployment and delivery operations

## Policy and activation

This is the #130 staging/release/hotfix delivery model. Code merged into staging is an integration candidate; production remains sourced from main. Implementation, GitHub checks and actual live acceptance are separate evidence. #44 live recovery acceptance remains open until the final workflows are exercised. #32 tracks versioned release URLs, tag automation and the remaining durable release-policy acceptance; this increment provides retained-channel rollback but does not automate GitHub Releases.

Planning lives in the [Roadmap 3 Wiki](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmap-3) and [Preparation milestone](https://github.com/HimanshuHD/papertrail-reader/milestone/7). This guide documents operation, not a parallel roadmap.

**Initial activation:** merge the implementation PR into staging after candidate CI passes. Its push runs staging integration and E2E. Reusable staging publication uses reviewed staging orchestration. Then create a release branch from staging, bump package.json/package-lock.json consistently, and open a reviewed release PR to main. Main's scheduled recovery, manual workflow form, workflow-run recovery and trusted PR-cleanup handlers become the new policy only after that release merges. During this short bootstrap period do not manually run the legacy main publisher: it does not preserve the new staging channel. Before activation, preview publishing can use the workflow on staging with target branch staging. Complete the configuration below before routine delivery.

## Branches and URLs

| Branch             | Source                         | PR target | Delivery                                       |
| ------------------ | ------------------------------ | --------- | ---------------------------------------------- |
| staging            | Initially current main         | —         | `/papertrail-reader/staging/`                  |
| feature/* or fix/* | Current staging                | staging   | Manual `/papertrail-reader/preview/pr-N/`      |
| release/X.Y.Z      | Accepted staging revision      | main      | Manual release preview; production after merge |
| hotfix/*           | Current main                   | main      | Manual hotfix preview; production after merge  |
| main               | Approved release/hotfix merges | —         | `/papertrail-reader/`                          |

The existing PAGES_BASE_PATH repository variable is supported; default is `/papertrail-reader/`. Use an absolute trailing-slash path. A custom-domain root can use `/`. Release branch names accept `release/vX.Y.Z` or `release/X.Y.Z`, and must match package.json. A package/version update is ordinary reviewed source, not an automatic release tag.

## Owner configuration

1. Keep GitHub Pages source **GitHub Actions** and the existing `github-pages` environment.
2. Protect both main and staging: require PRs, require **Candidate validation**, require branches up to date, block force pushes/deletion/direct pushes, and restrict bypasses. Choose required reviewer count appropriate to available maintainers; do not create a self-approval deadlock for a sole maintainer.
3. Allow github-pages deployments from main and staging. If environment approval is enabled, the shared aggregate publisher may ask approval for staging, previews, retirement and recovery as well as production. Separate approval policies would require splitting the shared-environment design.
4. Keep read-only default workflow permissions; jobs explicitly request their necessary writes. Do not send privileged tokens/secrets to fork PRs. Publication only accepts eligible same-repository candidates.
5. Do not enable merge queue yet: its merge_group validation trigger is not implemented. Strict up-to-date checks and promotion tree verification are the current policy.
6. Keep artifact retention at least 30 days for `candidate-build`, promotion plans and browser evidence. Fresh validation is required if a candidate expires. Retained published archives in pages-state provide channel rollback beyond candidate retention; review repository size/retention under #32 before large-scale use.

The connector cannot configure repository administration, environment reviewers or protection rules. These are owner settings, not checks that the implementation can claim passed.

## Feature and fix PRs

Create one implementation branch at a time from updated staging. Open a draft PR targeting staging. Application CI does not run while draft. Frontend CI runs for ready-at-opening, ready_for_review, synchronize and reopened-ready events; changing the target branch also validates again. Title/body edits do not repeat application tests or cancel active candidate checks. Their required gate verifies an actually successful target-channel artifact; skipped or failed earlier validation cannot pass. If no accepted artifact exists yet, fresh acceptance is required. Returning to draft cancels the old PR validation through concurrency and disables new preview requests.

Frontend CI checks lint, format, unit/pipeline tests, types and candidate builds. It checks out the combined PR merge tree, records head/base/merge identities, and requires the current target base to be an ancestor of the PR head. Update the branch from its target before accepting new checks. It builds separate preview and target-channel artifacts; each has its own base path and environment metadata. No site is published by PR CI.

`candidate-build` contains preview plus staging or production directories. Every channel has schema-2 build.json with source tree, candidate SHA, PR head/base, run ID, channel, URL base, version and SHA-256 file checksums. All files are verified before publication. Reserved state/channel directories and symbolic links are rejected.

## Manually publish a preview

1. Wait for the latest ready PR's **Candidate validation** to pass.
2. Actions → **Publish website** → Run workflow; normally select main as the trusted workflow branch after activation.
3. Choose target environment branch `staging` for a staging PR or `main` for a release/hotfix PR.
4. Choose operation `preview`, enter the PR number, and run.
5. Inspect the recorded result and `/preview/pr-N/`; compare its footer/SHA/build.json with the selected candidate, then compare against the correct stable environment.

Only ready open same-repository staging PRs, or release/_/hotfix/_ PRs targeting main, are eligible. Forks, drafts, closed PRs, arbitrary main-targeted feature PRs and old heads are rejected. A newer commit does not update the existing preview automatically; manually refresh after its checks pass. The published revision remains visible in its footer. PR head/base/state are checked again at the publication boundary.

## Staging integration

After merge to staging, **Integrate and promote** finds the successful current PR CI artifact. The actual merged source tree must equal the validated candidate tree; a SHA change from squash/merge is allowed only when content is identical. Lint/unit/type/build checks are reused rather than repeated. Staging Browser E2E downloads and tests the exact staging candidate at its staging base path; it does not rebuild or test the older live staging site.

After E2E succeeds, publication rechecks branch freshness, artifact provenance and checksums, preserves production/open previews, updates staging and runs live identity/critical-asset checks. The successful receipt is written only after these checks pass. The feature preview retires through independent cleanup.

If E2E fails, the deployed staging site stays at its last working revision. The staging branch can be newer than its deployment. Fix through another staging PR, or rerun a transient failed job. If merged content differs or no usable artifact exists, promotion stops: use manual Frontend CI recovery below. An older event cannot replace a newer channel.

## Release candidate

Select a successfully accepted staging revision and create release/<package-version>. Bump package.json/package-lock.json and maintain CHANGELOG/release notes. Open a draft PR to main; keep subsequent staging development independent of the frozen candidate.

Ready release PRs run frontend validation and Browser E2E against the production-path artifact. Every new ready revision invalidates previous acceptance. Both browser shards must pass. A manual release preview is available after all checks pass. Compare its source with the staging revision selected for the release, not blindly with a newer live staging deployment.

Release fixes must be synchronized into staging using a PR. Update the release branch from current main before final validation, particularly after a production hotfix. Strict branch checks and content identity prevent reusing checks for a different merged result.

## Production promotion and release publication

Merge only the final accepted release/hotfix PR. Integrate and promote verifies merged-tree equality and the successful candidate CI/browser run, then promotes its production artifact. Full frontend/E2E checks are not repeated after merge. Staging is preserved. Light live build-identity and critical JS/CSS checks run before the aggregate receipt is acknowledged.

After verified deployment, create the SemVer tag against the exact released main revision and publish the GitHub Release with reviewed notes. Tags do not trigger website publication. Automated tagged/versioned URLs and checksummed downloadable release packaging remain #32; do not describe those as delivered here.

Staging remains a working app. Its channel.json/footer reports alignment only when staging and production content-tree identities match. Otherwise it reports unreleased changes. Synchronize release metadata/fixes into staging before expecting alignment. No fallback page replaces staging on production release.

## Production hotfix

1. Branch hotfix/<description> from current main and target main.
2. Update the patch version/notes where appropriate; run ready frontend and production-candidate Browser E2E on every revision.
3. Optionally publish the hotfix PR preview; merge and promote the verified candidate.
4. Verify live identity/assets and publish the patch release against the verified main commit.
5. Raise synchronization PRs into staging and every active release branch. Resolve conflicts and rerun their acceptance. An active release must include current main before promotion.

Synchronization is explicit reviewed work; no workflow silently merges source branches. Emergency bypass is an owner decision that must record the reason and follow-up validation, not a default workflow path.

## Manual validation/recovery

For missing, expired, divergent or direct-push artifacts: Actions → **Frontend CI** → Run workflow → choose exactly main or staging. This validates and builds the current selected branch. Main recovery includes production Browser E2E. After success, the default-branch workflow_run handler starts integration; staging still passes its integration E2E. During bootstrap, rerun integration after main activation if that handler is not yet installed. Do not dispatch candidate validation on an arbitrary feature branch as a shortcut.

For saved-but-unacknowledged Pages state: Actions → **Publish website** → operation `reconcile`. It republishes the aggregate and cleans closed previews, without rebuilding source or accepting an unvalidated candidate. Blank PR number is no longer the legacy production-republish command. Normal source promotion belongs to Integrate and promote.

If a current source tree was saved but deployment failed, the saved state can be republished. An artifact that was never selected/validated cannot be invented by recovery. Fix actual CI errors before retrying. Explicit manual current-branch recovery can supersede a rollback hold: use it only after confirming whether redeploying current source is intended.

## Closed, draft and reopened PRs

The trusted pull_request_target cleanup handles closed, converted_to_draft and reopened events without checking out PR code. Closed previews become navigable retirement pages even if application deployment fails or a PR closes without merging. Staging previews link to staging; main release/hotfix previews link to production. Closing a PR with no published preview is a no-op.

Returning to draft disables publication and updates an existing preview's status notice; its published content is retained. Reopening does not restore retired content automatically. Run current ready checks and manually republish. Scheduled reconciliation covers missed cleanup events. Foreign-repository PRs never invoke privileged preview publication.

## Failed publication and receipts

Publication is serialized with pages-publisher, queue:max and cancel-in-progress:false. Up to 100 pending publishers are retained; ordering is not a freshness guarantee. Source checks and per-channel run guards still apply. Production/staging planning runs independently so one channel's failure cannot block the other's successful promotion.

The publisher commits the desired site to pages-state, uploads an aggregate excluding rollback archive payloads, deploys Pages and verifies live channels/assets. Only then it writes .publication-receipt.json and .deployment-history.json. A desired-state commit or successful Pages action alone is not accepted delivery. If Pages deployment or live verification fails, the receipt remains unmatched and recovery retries. A failed live check after Pages switched content cannot guarantee that the old site is still serving: inspect it and use rollback if necessary.

Publish website recovery runs at minutes 17 and 47 each hour; integration recovery scans current channel candidates at 23 and 53. GitHub schedules are best effort, with no bounded-time SLA. Current acknowledged state plus no cleanup is a no-op. API errors fail visibly, not as false acknowledgments. Check summaries and source identities rather than appearance alone.

## Explicit rollback

Published production/staging artifacts are retained in pages-state/.deployment-archives/<channel>/<tree-SHA>-<CI-run-ID>. They are not included in the live Pages artifact. .deployment-history.json records only archives acknowledged after successful live verification.

1. Inspect that history and select a known successful archive for the target channel.
2. Actions → Publish website → target branch main or staging → operation rollback → exact archive_id.
3. The publisher requires a published history entry, verifies the original channel/source/checksums, restores only that channel and preserves other channels/previews.
4. Verify the resulting live identity and receipt. Record the reason and selected version/run in the issue/release evidence.
5. Reconcile source with a revert/corrective PR and synchronize any production correction into staging/releases.

Rollback sets a hold on the current target-branch revision so scheduled integration does not immediately undo it. A new accepted source revision or explicit manual recovery can replace the rollback. Historical source identity remains the restored artifact's identity; the hold is recorded separately. Rollback is unavailable for pre-migration publications without a retained verified archive. Do not delete/modify archives manually while publication is running.

## Storage and environment identity

Production retains existing IndexedDB names so reading positions, annotations and library handles survive migration. Staging uses :staging and each preview uses :preview-N namespaces for PDF/EPUB metadata, annotations and workspace/file handles. Theme preference remains intentionally shared. Namespaces provide application isolation on a shared origin, not separate-origin security; staging source must remain trusted.

Footer labels identify production, staging or preview, environment branch/validated-head SHA and version/PR. build.json identifies the compiled candidate; deployment.json identifies the aggregate, merged sourceSha and per-channel run/tree/version. A reused artifact may show its validated PR head while deployment.json records the final merge; both must be retained, not falsely rewritten as the same commit.

## Evidence and completion

Record final-head CI and browser runs, merged source/tree, artifact run/channel, Pages/live verification, receipt, preview retirement and recovery/rollback checks. See [acceptance matrix](verification.md). Keep #130/#44 open for unverified live acceptance; merging implementation does not complete owner configuration or operational validation.

## Workflow map

| File                 | Responsibility                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| ci.yml               | Ready PR/manual recovery frontend validation, channel builds and required Candidate validation gate |
| browser-e2e.yml      | Reusable sharded tests of downloaded candidate artifacts                                            |
| delivery.yml         | Branch pushes, successful manual CI and scheduled integration recovery                              |
| channel-delivery.yml | Independent channel selection, tree/hash checks, staging E2E and promotion dependency               |
| pages.yml            | Trusted manual preview, serialized publication, cleanup, receipts and rollback                      |
| merge-tracking.yml   | Main-merge issue evidence; no repository roadmap writes                                             |

[Architecture](../architecture/deployment.md) · [Verification](verification.md) · [Documentation home](../README.md)

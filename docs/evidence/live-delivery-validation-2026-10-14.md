# Live delivery validation — 14 October 2026

Related: #44, #175, #130, #32.

## Accepted observations

- Acknowledged reconciliation no-op 38519850614, supplied by owner: success with Pages skipped.
- Staging rollback 38523106160: previously published archive b5745b3662a53ebb6790cc1ca24ac89f98cc4e32-38437966371 restored; live identity/assets verified and receipt recorded. Production candidate 38440711991/source db6029d unchanged. Hold binds staging to current branch 495b14e45e65bb7d5470662e4ef294471512b4d4.
- Reconcile 38523363688: success with deployment skipped; rollback hold retained.
- GitHub Pages environment inspected in authenticated UI: selected branches main/staging, zero tags, no required reviewers or wait timer. Settings were not changed.

## Reproduced manual recovery failure

Fresh current-staging Frontend CI 38523515478 passed. Integration 38523647029 verified its exact artifact; both browser shards passed. Publish job 115720976132 failed downloading promotion-staging because the promotion artifact was never uploaded. verify-delivery.mjs wrote publish=38523515478 from plan.manualRun, while channel-delivery.yml uploads the promotion artifact only for the literal true. The skip gate accepted this non-false string, so downstream browser/publication ran without their promotion metadata.

Convert the manual-run presence to Boolean before writing the output. The regression executes the real verifier against valid checksummed candidates, checks literal true for string/numeric manual IDs, false for ordinary docs-only/empty manual plans, and rejection of modified bytes. Source/tree/base-path/checksum trust checks remain intact.

## Outstanding acceptance

Restoration using the corrected normal manual-recovery path requires reviewed merge into the deployed trusted workflow code and a fresh run. An explicit rollback to the already published v2.1.0 staging archive is the operational fallback; its outcome is recorded in #175 after verification. Original main/preview/retirement overlap, cancelled-publication recovery, and complete PDF/EPUB/handle isolation remain separate live acceptance until their evidence is recorded. No production rollback or release publication was performed.

## Restored staging and retired preview

Fallback rollback 38524616594 passed live verification and successful receipt, restoring accepted v2.1.0 staging archive 7587a2a6c35650c468eee501a604b664b814a13b-38498206179. Production stayed source db6029d/candidate 38440711991. Staging hold remains intentionally; normal corrected recovery is not yet accepted.

Temporary PR #195 passed candidate 38524058601 and preview publication 38524924371. It was closed without merge; automatic cleanup 38525467351 passed, receipt marks it retired, and live browser inspection showed the closed page with a staging link. The publisher completed before a cancellation control could be reached; no cancellation result is claimed.

Live Chrome synthetic-file checks showed independent initial libraries, PDF positions/bookmarks across production/staging/preview #195, and EPUB chapter/bookmark isolation between production and preview. Production bookmark survived staging Forget library; restored staging required file reselection instead of treating cached listings as accessible files. Highlights/notes, retained native folder handles and second-preview isolation remain outstanding.

Fix revision 2f60475ecac039949d39fe4eea5bf3617d6171ef passed Frontend CI 38525086050 after the initial formatting-only failure 38524842431. The following documentation revision retains this tested script; owner merge and corrected live recovery remain pending.

## Accepted corrected staging recovery after #196 merge

Owner merged #196 into staging at baac0f8661e2acb453569710ad7eb60eb3989a8a. Push integration 38526472913 was deliberately cancelled while browser validation was running; publication skipped and no successful new receipt was fabricated. Its promotion-staging artifact already existed. This is cancellation before publication, not cancellation of a saved-state Pages publication or the original simultaneous production/retirement queue condition.

Fresh current-staging manual Frontend CI 38526691063 passed. Replacement integration 38526834306 passed both browser shards and publish job 115731408680, including live identity/assets and acknowledgement. Desired state equals receipt: source/artifact SHA baac0f8, tree 42e44d1c576a4ce1c00498fb5516fb4d01a15f59, candidate 38526691063, version 2.1.0. Rollback hold is empty. Production remains source db6029d/candidate 38440711991; both retired preview #195 and active preview #194 are preserved. This completes the staging rollback/hold/corrected-source recovery cycle.

Preview #194 published through 38526906910 from accepted candidate 38526511767, source 8338df78b42d660dcb9ee1d477f0c0bf76451e4e. It began with an empty library despite production and retired preview #195 metadata. Production EPUB chapter-two annotation/note survived reload and file reselection; identical EPUB in preview #194 showed zero annotations in both chapters. An initial batched preview-note attempt did not persist. A subsequent step-by-step chapter-two save passed: preview #194 showed exactly its PREVIEW 194 ONLY isolation note, while reopening production after that write showed only PRODUCTION ONLY isolation note. Two-way EPUB note/annotation isolation is accepted for this synthetic fixture. Earlier PDF/bookmark and library-clearing checks remain partial evidence.

Native folder selection did not emit an accessible filechooser within ten seconds; the application reported selection cancelled or permission denied and no files accessed. Retained native folder-handle acceptance remains blocked in this cloud browser. Full two-way PDF/EPUB annotation and native-handle isolation remains unchecked in #175/#130.

The equivalent production manual path still needs reviewed main propagation. No production change, release/tag publication or production rollback was made in this rehearsal.

## Post-sync acceptance and publisher retry defect

Owner merged #199 (main 23061bd03fa4b2af2926cf0be924a77a8214210e) and #200 (staging 5a79fd8ca7261f16fb512313a4bf21ea1ea95699).
Candidate-source binding fix passed full CI/production Browser E2E 38532689529.
Fixed staging integration 38535006467 passed both browser shards, publication, live verification and receipt.
Current-main manual CI 38534890069 and integration 38535981941 attempt 1 passed.
Production source 23061bd / candidate 38534890069; staging source 5a79fd8 / candidate 38534395756; rollback hold empty.

Owner native folder-access confirmation is accepted as owner evidence. Synthetic two-way staging/production PDF highlights and notes and EPUB notes were checked in live Chrome: each channel retained only its own named annotation after reopening the document. Historical preview/library/bookmark and two-way EPUB annotation checks remain accepted separately.

Temporary #201 was reopened solely for another queue rehearsal and closed without merge.
Retrying preview publisher 38535569522 attempt 2/job 115765411390 and main publisher 38535981941 attempt 2/job 115765709102 exposed a genuine failure:
deploy-pages found two artifacts named github-pages in the same workflow run and refused publication.
No receipt or live acceptance is attributed to those failed retries.
Closure cleanup 38538074670 succeeded, restoring acknowledged retired preview state.
The main retry had already started and was not cancelled; this does not prove queued-publication cancellation.

Fix: name upload/deployment artifacts with both workflow run ID and run attempt, using identical names in upload-pages-artifact and deploy-pages.
Retain earlier artifacts; do not delete evidence or bypass source, freshness, checksum, live verification or acknowledgement checks.
Regression models three uploads in one run and requires exactly one matching, current-attempt artifact for each deployment.
Reviewed merge and corrected live retry/queue rehearsal remain necessary before #44/#175 closure.

## Required-check collision found during #202 review

Label runs 38538805147 and 38538805535 emitted skipped Candidate validation checks while actual candidate run 38538517387 was still validating. GitHub accepts skipped required checks; the ruleset was active, but the duplicate required name created a merge-gate loophole.
Actual 38538517387 subsequently passed frontend, both browser shards and Candidate validation on 5125b9f8a3003a36669b2cbd069f7f77061b2206; that later success does not waive the loophole.

#202 also fixes the check name: only eligible validation events emit Candidate validation. Ignored events emit Metadata event (no candidate validation).
Regression evaluates the actual workflow name/condition, preserves a pending required check across ignored events, and runs the real gate shell script against failed/cancelled/skipped/missing frontend and browser results.
The regression fails against the old constant name; 20 focused tests and scoped lint pass with the fix. The new revision needs fresh GitHub validation before merge.

## Dynamic-name correction superseded

19158e0 full CI 38540346859 passed frontend, both browser shards and Candidate validation. GitHub still showed the required check Expected; retrying gate job 115776775738 did not clear association. Dynamic naming prevented a skipped pass but proved unreliable for required-check matching.

The replacement retains static Candidate validation and always runs the gate. Ignored metadata waits for another actual current candidate via existing tested waitForCandidate policy: exclude own run; exact expected head/base; successful frontend/gate and retained artifact. Skipped-build metadata runs cannot be producers. Failed/missing candidates, invalid provenance, changed source and bounded timeout have regression coverage. The normal gate rejects failed/cancelled/skipped/missing build/browser results. 27 focused tests and lint passed before commit. New GitHub validation and merge-panel acceptance remain pending.

## PR-only Visual QA condition regression

Frontend 38542444749/job 115780263991 failed the existing Visual QA PR-only test because the shared eligibility clause included workflow_dispatch inside the Visual QA job. No candidate artifact was produced; metadata run 38542456064/job 115780305081 correctly failed CANDIDATE_UNAVAILABLE after waiting rather than passing invalid acceptance.

Correction restores Visual QA's PR-only condition while separately excluding ordinary labels and body/title edits, even on a PR already labelled qa:visual. New regression evaluates the actual Visual QA expression for ordinary labels, QA labels, base edits, manual dispatch, failed/cancelled/skipped gates, draft/closed/fork/unlabelled PRs. Existing PR-only/no-write/no-secret assertion remains unchanged. Full local pipeline suite: 74 passed, zero failures; lint passed. Fresh remote CI and final merge-panel acceptance remain pending.

## Post-#202 production and staging synchronization

Owner merged #202 at main 6e08463a0ac9f6d1eb7f1c28512c9219b0fb0fe8. Final candidate 38543009222 and metadata acceptance 38543023496 succeeded. Main integration 38544156936/publisher 115786046044 passed live channel identity/assets and acknowledgement. Current-main manual validation 38544645993 passed both browser shards; integration 38545745778 and subsequent 38546382107 published that verified candidate. Production remains v2.1.0; original release tag is unchanged.

Sync PR #203, head 668d84e1f8d21597236bcc78f750b78b12446fd6, retains main/staging ancestry and staging-specific measurement workflow/script, architecture notes and release records. Candidate 38544557916 and metadata 38544904886 passed. Owner sync merge and post-merge staging acceptance remain pending. Refresh its ancestry after the cancellation-guard hotfix is merged.

## Synthetic channel isolation and preview lifecycle

Temporary #204 candidate 38544765030 and manual preview publication 38545036220 passed on source 7d0cf33e0973cb7201c891541b95b96449dc1688. Live Chrome began with an empty preview library despite populated production/staging. Identical PDF opened page one with zero annotations, while production page-one and staging page-two notes remained independent. Saving PREVIEW 204 PDF ONLY isolation note produced one preview annotation; reopening production/staging showed only their own notes.

Identical preview EPUB began chapter one with zero annotations. Saving PREVIEW 204 EPUB ONLY isolation note produced one preview annotation; production reopened chapter two with only PRODUCTION ONLY isolation note and staging chapter one with only STAGING EPUB ONLY isolation note. Reloads retained channel-specific saved listings and required explicit file reselection rather than inheriting live file access. Earlier bookmark/second-preview and two-way stable-channel annotation evidence remains accepted. Native folder functionality is owner-accepted, not an automated native-handle test.

Converted-to-draft cleanup 38545567885 succeeded, retained published preview content and acknowledged draft:true. Manual visual confirmation of the draft footer notice remains unverified. Marking #204 ready again was rejected by automatic approval review; no workaround transition was performed. Closed without merge; retirement 38546526845 succeeded and receipt marks #204 retired. Repeated aggregate publication preserved required retirements and both stable channels.

## Queued cancellation defect reproduced with a bounded read-only lock

Earlier cancellation requests during 38544156936/38546382107 did not produce cancelled publisher jobs; those jobs finished successfully and are not accepted cancellation evidence. Distinct attempt artifacts and live verification/receipts prove the #202 retry artifact fix works.

Temporary test branch test/44-readonly-queue-hold, commit 3bdac68bcc43b57dd82c4827bacd0494f48a19f0, changes only pages.yml to a contents:read, three-minute queue hold. It was not merged and cannot publish artifacts or change Pages content. Lock run 38565192977/job 115855974419 held the shared concurrency queue from 12:37:16Z to 12:40:18Z on 14 October.

Production integration 38546382107 attempt 4/publisher 115856193198 was pending with zero steps while held. GitHub acknowledged the cancellation request. Despite that request, the publisher started at 12:40:23Z after the lock released and succeeded at 12:40:46Z, including deployment and acknowledgement. This decisively reproduces the cancellation guard defect: channel-delivery.yml publish uses always() without !cancelled(), keeping it eligible after cancellation.

Fix adds !cancelled() to the integration publication condition and independently to the shared publisher job. Keep always() for skipped main-browser dependency handling, plus all selection, browser, trust and integrity checks. Regression evaluates actual workflow expressions for cancellation, both branches, skipped main browser, failed selection, failed required staging browser, trusted lifecycle events and foreign-PR rejection. Full local pipeline suite: 76 passed; scoped lint passed. Reviewed main merge, staging sync and corrected terminal queued-cancellation/retry evidence are still required. Do not close #44/#175/#130 from these failed cancellation rehearsals.

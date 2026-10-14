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

Preview #194 published through 38526906910 from accepted candidate 38526511767, source 8338df78b42d660dcb9ee1d477f0c0bf76451e4e. It began with an empty library despite production and retired preview #195 metadata. Production EPUB chapter-two annotation/note survived reload and file reselection; identical EPUB in preview #194 showed zero annotations in both chapters. A preview-note save attempt did not produce a persisted annotation, so successful preview-note creation is not accepted here. Earlier PDF/bookmark and library-clearing checks remain partial evidence.

Native folder selection did not emit an accessible filechooser within ten seconds; the application reported selection cancelled or permission denied and no files accessed. Retained native folder-handle acceptance remains blocked in this cloud browser. Full two-way PDF/EPUB annotation and native-handle isolation remains unchecked in #175/#130.

The equivalent production manual path still needs reviewed main propagation. No production change, release/tag publication or production rollback was made in this rehearsal.

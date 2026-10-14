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

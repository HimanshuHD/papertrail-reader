# Deployment verification

## #108 production workflow verification — 3 October 2026

Merged #108 source `94c6be4adac1d56ed897b477653e75942a662c22` passed main Frontend CI [37105807478](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37105807478). Dependent publisher job `111154050458` succeeded, verified that source SHA, uploaded the aggregate Pages artifact and completed deployment. Its recorded production URL is https://himanshuhd.github.io/papertrail-reader/. Publication is inside the Frontend CI run; no standalone automatic Publish website run was created for this source. This is job/log evidence, not an interactive website inspection.

#100 remains open for pure docs-only PR/readiness/main behavior and manual preview acceptance. #106 changes reconciliation workflow paths along with documentation, so it cannot establish docs-only filtering by itself.

Updated: 2 October 2026. Owners: #31/#35/#39.

## Current production evidence after #98

Merge 376323ce2171eb17f45ecded2f266cf431baa07e passed main CI 37045669575 and issue reconciliation 37045671003. Publisher 37045732211 succeeded; pages-state/deployment.json records production source 376323c/source CI 37045669575 and preview #98 retired. #86/#87 are completed. This is workflow/source metadata verification, not a new interactive live-site audit. Final screenshots and current documentation are preserved in docs-only PR #99. Next #89, then final regression and release #80.

## Historical production evidence after #97

Merge f44d67517ba17053d15e4b420372526a5002a10c passed main CI 37041483607 and issue reconciliation 37041484160. Publisher 37041555992 succeeded; pages-state/deployment.json records production source f44d675/source CI 37041483607 and preview #97 status retired. This is workflow/source metadata verification; no new interactive live-site audit is claimed. PR #98 holds the current #86/#87 increment and preserved #85 screenshots. Its preview is published manually after browser acceptance.

Earlier verification records below are historical.

## Verified behavior

| Check                        | Evidence                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Main website publishing      | Main CI 36899758338 and publisher 36899823762 passed; production metadata SHA 26eb4ff7e4a9364d477111d1374594a7f512acb5      |
| Manual current-PR preview    | Publishers 36896874008 / 36897640978 succeeded for PR #38; latest deployed PR SHA de5f922 verified                          |
| No automatic preview updates | Preview stayed at 33004681 after footer commits until manually redeployed; open-PR publisher 36895910760 skipped deployment |
| Production/preview isolation | Separate assets/base paths; preview publishing preserved production SHA                                                     |
| Closed preview               | #38/#40 retired; #40 HTTP 200 includes styled card, PR identity and ../../ production link                                  |
| Footer identity              | Production and preview builds embed deployed source SHA; PR #40 adds linked branch names                                    |
| Merge tracking               | PR #38/#40 reconciliation passed; issue/progress writes verified                                                            |

Production: https://himanshuhd.github.io/papertrail-reader/. Retired PR #40: https://himanshuhd.github.io/papertrail-reader/preview/pr-40/.

PR #41 merged at b54d41d236fd561d651404e1478e98b3d59328c7. Its pre-merge CI 36901032233 passed; post-merge deployment evidence is recorded separately from this historical #40 verification.

## Final check for #35

Merge the docs-only audit PR. Before merging, record current production SHA from build.json/deployment.json. After merge:

1. Identify the successful main push CI run for the audit merge commit.
2. Confirm its artifact build.json records publish=false.
3. Confirm automatic Publish website succeeds with deployment/upload/state-write steps skipped.
4. Confirm live production SHA stays unchanged.
5. Record run/commit evidence here and in #35, then close #35 and update parent #5.

Unit policy tests passed, but the above live main-branch check has not happened yet. Do not close #35 before the evidence is recorded.

## Known delivery caveat

Pending publisher 36894992262 was cancelled during overlapping cleanup/production events; retry publisher 36895563022 recovered production. #44 now tracks durable reconciliation. Current concurrency should not be described as a lossless deployment queue.

PDF/EPUB functionality, supported-browser acceptance (#28) and versioned release promotion (#32) remain outside these deployment checks.

## Post-merge #50 checkpoint

PR #50 merged at 3a1a82d5ceb6e518cefcbafe43dedacef3723808. Final PR CI 36912595432 passed 15 Chromium tests and ordinary checks; screenshots were reviewed. Merge tracking 36913102803 and preview-retirement publisher 36913124246 succeeded. Main CI 36913103586 and production publisher 36913855022 passed. Live build.json and deployment.json both report source 3a1a82d5ceb6e518cefcbafe43dedacef3723808 and CI run 36913103586; preview #50 is retired. The retirement deployment preserves the previous production build while replacing preview/pr-50 with the closed page. Do not infer app source identity from the Pages workflow SHA alone.

## PR #60 production verification — 2 October 2026

- Merged PR #60 source: `e159ab14d0a85af58b5e0697163cf688193f6cc0`.
- Main Frontend CI [36964378879](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36964378879) passed lint, formatting, tests, type/build and artifact identity.
- Publishers [36964390169](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36964390169) and [36964422783](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36964422783) passed (production publication and preview retirement).
- Live production build.json/deployment.json identify the same source and CI run. Current main `908cbc08` is a tracking-only successor and should not replace the last website source identifier.
- Production HTML, JS/CSS and `assets/pdf.worker.min-Dswkl-cV.mjs` returned HTTP 200; worker Content-Type is text/javascript.
- `/preview/pr-60/` returned HTTP 200 with the Preview closed page; manifest marks #60 retired.
- This verifies delivery, not full interactive browser acceptance. Browser E2E 36963474599 failed on an earlier PR head; #61 fixes the remaining navigation selector and records new acceptance.

## PR #71 production verification — 2 October 2026

- PR #71 merged at 2026-10-02T11:02:59Z; merge commit: `9e5db87a38673651214989053c495270ed9b73df`.
- Main Frontend CI [36998853805](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36998853805) passed.
- Post-merge tracking reconciliation [36998854286](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36998854286) succeeded.
- Production publisher [36998900442](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36998900442) succeeded after the main build.
- Pages deployment metadata records production source `9e5db87a38673651214989053c495270ed9b73df` and CI run `36998853805`; preview #71 is marked retired.
- Issues #63 and #72 are completed. This records deployment identity and workflow success; interactive PDF behavior is covered by the pre-merge Browser E2E evidence above.

## Post-merge and lifecycle acceptance — PR #73 / #77

PR #73 merged at 2026-10-02T12:11:18Z as 058195008dca9fc6797f035c272801fdd5f0d0f9. Main CI 37005211269, tracker reconciliation 37005211500 and production publisher 37005270079 passed. Deployment metadata identifies that source and CI run; preview #73 is retired. #64/#74/#75/#76 are completed. This is workflow/metadata evidence, not a new live interactive browser audit.

PR #77 adds the remaining direct lifecycle tests for reopened #10 on test/10-pdf-lifecycle. Frontend CI 37005502235 passed on 13647f6, including new canvas replacement, text-layer cancellation, teardown order and repeated-close tests, plus existing document-switching/viewport disposal coverage. No application behavior changed. #10 remains open until this acceptance PR merges. Next product work is PDF saved positions/bookmarks #13; EPUB #12 stays next-version scope.

## PR #77 merge and first-release planning

PR #77 merged as b41d3799bd41f278b50e1a39435dc41e7e9b41bc. Main Frontend CI 37006040941, tracking reconciliation 37006041258 and production publisher 37006094713 passed. Pages metadata identifies that source and CI run. This is workflow/metadata evidence, not a new interactive production audit. Roadmap #1 now targets v1.0.0 after bug acceptance #79 and release preparation #80. No release tag, version bump or publication is performed by the planning change; advanced version promotion #32 remains in Roadmap 2 #78.

## PR #90 merge verification — 2 October 2026

- Merge source: c191353b17391c8f1e5a3e9a820e5d863a06498b.
- Main Frontend CI: [37033803318](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37033803318), succeeded.
- Issue reconciliation: [37033803232](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37033803232), succeeded; #88/#91–#95 closed.
- Production publisher: [37033885573](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37033885573), succeeded. Publisher workflow SHA 213be458 is the later tracker commit; deployment.json correctly records application source c191353 and CI 37033803318.
- pages-state/deployment.json marks preview #90 retired.
- Pre-merge Browser E2E 37032676748 passed 61 checks. Verification here is workflow/source metadata, not a fresh live UI audit.

## PR #96 merge verification — 2 October 2026

Main CI [37036588000](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37036588000), reconciliation [37036588403](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37036588403) and production publisher [37036656072](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37036656072) succeeded. Production metadata identifies a35e2c5af7dbd0b04dc8e29a5d13854af7a90274 and CI 37036588000; preview #96 is retired. Publisher source efa1925 is the later tracking commit, not the application source recorded by deployment.json. #84 is closed completed. Pre-merge Browser E2E 37035868237 passed 66 checks. This is workflow/source metadata verification, not a new interactive live audit.

## Current reconciliation — merged #97

PR #97 merged as f44d67517ba17053d15e4b420372526a5002a10c. Final Frontend CI 37040435175 passed 83 unit and 6 pipeline tests plus lint/format/types/build. Browser E2E 37040700001 passed 71 checks without retries (four intentional duplicate long-document skips). Main CI 37041483607, reconciliation 37041484160 and production publisher 37041555992 passed; production metadata records f44d675 and source CI 37041483607. Screenshot documentation is being preserved with the combined #86/#87 PR. #85 is completed; #79/#1/#80 remain open. #86 and #87 are the current combined increment; #89 and final regression remain before release.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](../evidence/reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## Current v1.0.0 deployment reconciliation — merged #103

PR #103 merged as b2eb9328be5147346926e9bbce0960fa777b9e00. Main Frontend CI 37054802868 passed 87 unit/six pipeline tests, lint/format/types and the v1.0.0 production build. Reconciliation 37054803201 and publisher 37054875000 succeeded; Pages upload/deployment ran successfully. Deployment state identifies production b2eb932/source CI 37054802868. The owner confirmed the main deployment footer shows v1.0.0 and SHA b2eb932 on 3 October 2026 (Asia/Kolkata). This is owner UI verification plus source/workflow metadata, not a new exhaustive production browser audit. Final explicit candidate Browser E2E 37053754669 passed 81 checks without retries (four deliberate duplicate long-document skips). Branch inventory contains only main and pages-state; the merged release/1.0.0 branch is already removed. No v1.0.0 tag or GitHub release exists yet; #80/#1 remain open only for tagging/release and final ledger reconciliation. #79 is complete; Roadmap 2 #78/#100 remains deferred until that handoff.

## Final release reconciliation — 3 October 2026

Published stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) at 2026-10-02T19:55:40Z (3 October 2026, 01:25:40 Asia/Kolkata). GitHub API verifies the lightweight tag directly targets reviewed/deployed merge b2eb9328be5147346926e9bbce0960fa777b9e00. Main CI 37054802868 and publisher 37054875000 passed; owner confirmed production v1.0.0/SHA b2eb932. #79, #80 and first-release roadmap #1 are completed. Roadmap 2 #78 is open and ready; PDF saved positions/bookmarks #13 is the next feature, with #100 publishing maintenance retained as unfinished scope. Historical pending-tag and deferred-handoff entries are superseded by this verification.

Merged documentation PR #104 passed main CI 37056086312 and reconciliation 37056086941. Publisher 37056172706 succeeded with upload/deploy/URL steps skipped for docs-only input. Production remains b2eb932/source CI 37054802868. Tag/release publication created no additional Actions run in the reviewed latest-run listing. #100 retains event-level docs-only publisher filtering for Roadmap 2.

---

[Previous](publishing.md) · [Documentation home](../README.md)

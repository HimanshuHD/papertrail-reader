# Deployment verification

Updated: 1 October 2026. Owners: #31/#35/#39.

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

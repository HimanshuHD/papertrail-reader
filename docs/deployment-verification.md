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

PR #50 merged at 3a1a82d5ceb6e518cefcbafe43dedacef3723808. Final PR CI 36912595432 passed 15 Chromium tests and ordinary checks; screenshots were reviewed. Merge tracking 36913102803 and preview-retirement publisher 36913124246 succeeded. Production publishing follows the main CI 36913103586; its live source SHA must be checked after publishing. The retirement deployment preserves the previous production build while replacing preview/pr-50 with the closed page. Do not infer app source identity from the Pages workflow SHA alone.

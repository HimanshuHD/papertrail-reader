# Production and preview verification

Date: 1 October 2026. Related issue: #31; deployed pipeline PR #33; temporary preview PR #34.

| Channel            | URL                                                           | Result                                                                                           |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Production         | https://himanshuhd.github.io/papertrail-reader/               | HTTP 200; browser renders The foundation is ready                                                |
| Active PR preview  | https://himanshuhd.github.io/papertrail-reader/preview/pr-34/ | Originally active and separately verified; after closure, serves retirement page linking to main |
| Retired PR preview | https://himanshuhd.github.io/papertrail-reader/preview/pr-33/ | HTTP 200; retirement page links to main                                                          |

Production manifest source: 16e854621c419341b730bfa81d97ff222c93a2df, CI 36890356694. Preview source: 9711a556de02aba121ba01739ab59c6444dd1444, CI 36891363513. Preview publisher run: https://github.com/HimanshuHD/papertrail-reader/actions/runs/36891403655 (success).

The preview's HTML references assets under its own preview path. Publishing the preview preserved production's source SHA and screen content. An initial preview request returned 404 during propagation; subsequent requests at the normal URL and browser reload succeeded.

PR #34 is a draft with a one-heading verification change. It was closed without merging. PR #36 fixes lookup for closed unmerged PRs. Publisher run 36895110066 retired #34 successfully; live HTML and deployment.json report retirement. PR #36 also merged and retired. Main remains the production source. This is pipeline verification, not complete PDF/EPUB functionality or cross-browser acceptance (#28). Versioned releases/promotion remain #32.

## Policy verification after PR #36

Merge tracking run 36894959027 succeeded. Retirement passed. #35 remains open for live manual current-head publishing and unchanged preview after a subsequent push, plus docs-only main filtering. A queued production run was cancelled during overlapping cleanup; production CI was retried. Automated policy/assembly tests remain necessary but do not replace these live checks.

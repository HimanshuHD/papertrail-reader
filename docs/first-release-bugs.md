# First-release bug tracking

Parent: [#79](https://github.com/HimanshuHD/papertrail-reader/issues/79). Roadmap: [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1). Release gate: [#80](https://github.com/HimanshuHD/papertrail-reader/issues/80).

## Intake and triage

Capture reproducible defects in the delivered browser PDF product. Agree the release-fix list before implementation. “Lock the bugs” means agree this list; GitHub discussions remain available. Scope changes after agreement require an explicit disposition.

No new defect children are recorded yet. Previous toolbar/search/slider fixes #74/#75/#76 are merged. Deferred infrastructure issue #44 should be assessed for current release impact if reproduced.

## Child issue template

- Parent: #79; Roadmap: #1; Related: affected implementation issue.
- Reproduction: smallest reliable steps and safe file characteristics.
- Expected / actual behavior.
- Environment: browser/version, OS, viewport and relevant file-selection capability.
- Severity / first-release blocker decision, with reason.
- Fix branch, issue-referencing commits and PR.
- Verification: focused regression, applicable browser checks, preview review and post-merge deployment evidence.
- Disposition: fixed, duplicate, unable to reproduce or explicitly deferred to #78.

Never include private document content in evidence. Track one defect per independent fix; group related symptoms sharing the same root cause. Use reciprocal issue references and parent checklists for child relationships.

## Completion

#79 closes after all agreed release-blocking children are fixed, validated and merged, and final PDF smoke/regression results plus known limitations are recorded. Non-blocking deferrals must link #78 with a reason. Then #80 prepares v1.0.0. #1 closes only after that release is verified.

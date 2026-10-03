# Branch maintenance

Roadmap owner: [#78](https://github.com/HimanshuHD/papertrail-reader/issues/78) · [Roadmap documentation](../roadmaps/roadmap-2.md) · [Current progress](progress.md). This record includes historical evidence; current statuses come from the progress tracker and live issues.

Audit: 2 October 2026 (Asia/Kolkata), after PR #50.

Keep main as the source branch and pages-state as the generated aggregate deployment branch. pages-state contains production and preview state and is required by the publisher.

## Verified cleanup candidates

No open PRs existed at this audit. Each branch head matches its closed PR head, so no commits were added after closure/merge.

| Branch                          | PR  | Disposition                                                 |
| ------------------------------- | --- | ----------------------------------------------------------- |
| chore/2-repository-setup        | #20 | Merged; safe cleanup candidate                              |
| chore/3-vue-vite-bootstrap      | #29 | Merged; safe cleanup candidate                              |
| chore/22-frontend-quality       | #38 | Merged; safe cleanup candidate                              |
| chore/31-pages-pipeline         | #33 | Merged; safe cleanup candidate                              |
| chore/31-preview-verification   | #34 | Closed unmerged; obsolete preview-verification heading only |
| chore/35-on-demand-previews     | #36 | Merged; safe cleanup candidate                              |
| docs/35-architecture-audit      | #45 | Merged; safe cleanup candidate                              |
| feat/6-theme-state-foundation   | #41 | Merged; safe cleanup candidate                              |
| feat/39-preview-status          | #40 | Merged; safe cleanup candidate                              |
| feat/46-47-theme-toggle-version | #48 | Merged; safe cleanup candidate                              |
| feature/42-reader-shell         | #50 | Merged; safe cleanup candidate                              |

Deletion is pending: the connected GitHub toolset has no branch-delete operation. Web UI fallback requires separate user approval before use. This audit does not claim branches have been deleted. Preserve linked PR/commit evidence; remove only the verified obsolete heads after approval.

For #34, comparison shows one verification-only change in src/App.vue: heading The foundation is ready → Preview verification build. Its preview was retired and the branch is not an active feature.

After cleanup, normal work is issue → new branch from main → PR/CI → review/merge → status reconciliation → delete merged work branch. Keep generated deployment state out of development.

## Fresh branch inventory — 2 October 2026

The earlier 11-branch pending-cleanup record is historical. Fresh inventory contains main, pages-state and the merged `feat/11-pdf-search-contents-shortcuts` at `3363ee512a6c4001200d7615eb6855b5ae928d98` (PR #60). The feature head matches the merged PR and can be deleted. Keep main/pages-state. #61 creates a new active fix branch which must remain until reviewed/merged. No branch deletion is performed by this reconciliation.

## Release branch cleanup — 3 October 2026

PR #103 merged release/1.0.0 (reviewed head ff159b5) as b2eb9328be5147346926e9bbce0960fa777b9e00. The branch is safe to delete after merge; a fresh branch listing already shows it removed and contains only main/pages-state. No deletion by the assistant is claimed. Removing a merged branch does not remove the reviewed commit; the v1.0.0 tag must target that exact merge SHA once created. New release reconciliation uses a separate docs branch, leaving the removed release branch closed. Keep main and generated pages-state.

## Final release reconciliation — 3 October 2026

Published stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) at 2026-10-02T19:55:40Z (3 October 2026, 01:25:40 Asia/Kolkata). GitHub API verifies the lightweight tag directly targets reviewed/deployed merge b2eb9328be5147346926e9bbce0960fa777b9e00. Main CI 37054802868 and publisher 37054875000 passed; owner confirmed production v1.0.0/SHA b2eb932. #79, #80 and first-release roadmap #1 are completed. Roadmap 2 #78 is open and ready; PDF saved positions/bookmarks #13 is the next feature, with #100 publishing maintenance retained as unfinished scope. Historical pending-tag and deferred-handoff entries are superseded by this verification.

Merged documentation PR #104 passed main CI 37056086312 and reconciliation 37056086941. Publisher 37056172706 succeeded with upload/deploy/URL steps skipped for docs-only input. Production remains b2eb932/source CI 37054802868. Tag/release publication created no additional Actions run in the reviewed latest-run listing. #100 retains event-level docs-only publisher filtering for Roadmap 2.

## Workspace restoration handoff — 3 October 2026

PR #119 is merged at `7dc8bca1bcf9f3eb9f78c75150e2dc7b25241c48`; accepted feature head is `deed40b317099d0878fdd0dd8110fa3c4ef879aa`. Create `feat/115-pdf-bookmarks` from reconciled main for #115. `feat/workspace-restoration` is no longer the active implementation branch. No branch deletion or unverified branch inventory is claimed. Keep main and generated pages-state.

---

[Previous](first-release-bugs.md) · [Documentation home](../README.md)

## Bookmark merge and next increment — 4 October 2026

#120 merged as `0b2b5c1`; owner confirmed validation. #115 is completed and its active status label is removed. PDF increments #114/#117/#118/#115 are completed; #13 stays open only for separate format acceptance after #12. Preparation milestone 1 is confirmed closed through #100’s embedded milestone metadata. Reading continuity milestone 2 stays open for #14 and unfinished format scope. Next branch: `feat/14-recent-library-search`, from reconciled main. Prior pending-review/milestone-closure statements are historical and superseded.

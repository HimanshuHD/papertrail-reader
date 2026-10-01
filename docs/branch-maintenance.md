# Branch maintenance

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

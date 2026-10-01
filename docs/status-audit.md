# Issue and documentation audit

Date: 1 October 2026. Scope: #1/#35. PR #41 remains under owner review; #7 implementation is paused.

| Issue      | Status                   | Evidence / next action                                                              |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------- |
| #2/#3/#30  | Completed                | Repository/bootstrap/web-first scope merged; stale pending text corrected           |
| #21        | Completed                | Real tracking writes verified, including PR #38/#40 merges                          |
| #22        | Completed                | Quality checks delivered in PR #38                                                  |
| #31        | Completed                | Production/preview isolation, publishing and retirement verified                    |
| #39        | Completed                | Styled retirement page and linked branches in merged PR #40, checked live           |
| #6         | In review                | PR #41 CI 36901032233 passed; owner review/merge pending                            |
| #35        | Final live check pending | Docs-only main publishing skip must be verified after the docs-only audit PR merges |
| #5         | In progress              | #35 final acceptance and #37 browser E2E remain                                     |
| #7         | Backlog / paused         | Linked children #42 layout and #43 keyboard/status states                           |
| #37        | Backlog                  | Browser E2E follows #7/#8 behavior                                                  |
| #26/#19    | Partial delivery work    | Release promotion, worker assets, product/browser acceptance remain                 |
| #32        | Backlog                  | Versioned releases/promotion not implemented                                        |
| #44        | Backlog                  | Reconcile a cancelled pending publisher; observed cancellation tracked separately   |
| #4/#23/#27 | Deferred                 | Desktop scope after web release                                                     |

#35 implementation is merged. Manual preview/current SHA, no-auto-update on later commits, production updates, footer identity and closed-preview retirement have live evidence. The remaining docs-only main check is deliberately not marked complete from unit tests alone. The audit PR changes only docs/, making it a controlled validation event.

## UI child tracking

#7 -> #42/#43 uses reciprocal Parent references and issue checklists. Current tools do not expose native GitHub sub-issue writes, so these are linked child issues rather than a claim that GitHub's native hierarchy has been configured. #37 provides real-browser acceptance infrastructure without duplicating UI implementation.

#6 remains a cohesive foundation increment; no artificial children are needed for its already implemented/reviewable scope. Split future issues when implementation/validation boundaries warrant it.

## Documentation audit

Vue architecture: architecture.md plus vue-architecture.md, with an explicit implemented / PR #41 under review / future distinction. Deployment architecture: deployment.md plus deployment-architecture.md, including artifact trust, pages-state, trigger policy, concurrency limits and release gaps.

Architecture changes must update module ownership/contracts and docs in the same PR. The roadmap PDF is a planning snapshot; live issues and progress track delivery. Documentation-only changes validate in CI and should not update production automatically.

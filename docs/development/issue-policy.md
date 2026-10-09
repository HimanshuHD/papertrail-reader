# Issue, label and milestone policy

GitHub issue state and acceptance are authoritative. [Wiki Roadmaps](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmaps) owns planning; [milestones](https://github.com/HimanshuHD/papertrail-reader/milestones) group delivery. Repository roadmaps/progress files are historical archives.

## Lifecycle

| Stage       | Label                                   | Evidence                                                             |
| ----------- | --------------------------------------- | -------------------------------------------------------------------- |
| Planned     | `status:new`                            | Scope, acceptance, parent and milestone                              |
| Active work | `status:in-progress`                    | Branch and current implementation                                    |
| Review      | `status:in-review`                      | Linked PR, green checks and validation                               |
| Blocked     | `status:blocked`                        | Blocking issue and reason                                            |
| Deferred    | `status:deferred`                       | Explicit later scope; currently desktop #4/#23/#27                   |
| Completed   | No active status label; close completed | Merged implementation, met acceptance and required live verification |

Use one active status label at a time. `status:duplicate` and `status:invalid` explain closed dispositions; they do not count as completed acceptance. Moving scope to a future roadmap uses `status:new` when it is still planned, rather than leaving it deferred without a plan.

## Type and severity

Use the existing `type:bug`, `type:enhancement`, `type:documentation` and `type:accessibility` labels as applicable. Documentation chores use `type:documentation`; no extra chore label is needed.

Bugs use `severity:critical` for unusable core reading/data loss, `severity:high` for major functionality blocked, `severity:medium` for significant defects with a workaround, and `severity:minor` for limited visual/usability defects. Severity describes impact; milestones and explicit release gates decide delivery priority. Do not assign bug severity to routine documentation or feature work.

## Relationships and review

Assign planned issues to the actual owning milestone. Group related symptoms only when they share actionable scope. Link parent and children reciprocally, retain acceptance checklists, and record branch, commits, PR, test evidence and merge source. `Refs #N` keeps an issue open for outstanding acceptance; use `Closes #N` only when completion is justified. The owner merges PRs.

PRs start in draft and become ready only after Frontend CI passes. Automatic Browser E2E runs at draft → ready for review for eligible non-docs PRs only. Updates to a ready PR get Frontend CI; deliberately dispatch Browser E2E when later changes require it. Publishing previews remains manual. Reconcile issue labels/acceptance and milestone grouping after merge; update Wiki scope/decisions when necessary. Do not write current status to repository tracker archives.

---

[Previous](workflow.md) · [Documentation home](../README.md) · [Next](browser-testing.md)

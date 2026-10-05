# Product Roadmap 3

Owner: [#107](https://github.com/HimanshuHD/papertrail-reader/issues/107). Status: new, planned; implementation has not started. Delivery tracking: [progress tracker](../trackers/progress.md).

## Preparation

| Issue                                                              | Scope                                                             | Status                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| [#129](https://github.com/HimanshuHD/papertrail-reader/issues/129) | Release-only Browser E2E; formal release/staging event acceptance | New; merged workflow prototype, remaining acceptance planned |
| [#130](https://github.com/HimanshuHD/papertrail-reader/issues/130) | Staging integration, staging-only previews and stable staging URL | New; unimplemented                                           |

#129 was automatically closed on #125 merge and has been reopened per the owner's planning instruction. Its prototype is in main; staging routing/deployment has not changed. Actual Roadmap 3 Preparation milestone assignment is pending identification/creation; #129's existing Roadmap 2 milestone association is not the intended planning ownership.

## Multiple-document workspace

| Issue                                                            | Scope                                                              | Status                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Independent document tabs, session restoration and resource limits | New; removed from Roadmap 2 milestones |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Document comparison and portable annotation export                 | New; removed from Roadmap 2 milestones |

Implement workspace/session/resource boundaries before comparison/export. Define Roadmap 3 milestones and acceptance before starting implementation. No Roadmap 2 delivery commitment is retained for these issues.

See [Roadmap 2](roadmap-2.md) for current scope. Desktop #4/#23/#27 remain deferred separately and are not part of this roadmap.

---

[Previous](roadmap-2.md) · [Documentation home](../README.md)

## Owner merge / next-work reconciliation — 5 October 2026

Owner merged PR #138 as `fa709356eee6a08bdac41e76986aa0cc46d1c610`. Accepted source `3e4fef1` passed Frontend CI 37229583694 and Browser E2E 37229662269 (152 passed, zero failed/flaky, eight intentional duplicate skips). #12/#134 are closed/completed and stale active labels are removed. EPUB milestone 3 is verified open with zero open and ten completed issues; owner closure is now appropriate.

Deferred observations are tracked in [#139](https://github.com/HimanshuHD/papertrail-reader/issues/139), status:new under reliability #16/roadmap #78. Roadmap 2 remains open for annotations, reliability/browser and delivery scope. #129/#130 remain Roadmap 3 Preparation planning with owner milestone assignment pending. Earlier review/merge/count checkpoints are superseded.

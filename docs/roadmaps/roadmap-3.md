# Product Roadmap 3

## Current planning decision — 5 October 2026

EPUB milestone 3 is closed with zero open and ten completed issues. Roadmap 2 #78 continues with annotations parent #15 and new children #140 (storage/anchors), #141 (PDF highlights), #142 (EPUB highlights), #143 (notes/panel), #144 (local statistics) and #145 (acceptance), all assigned to milestone 4. Implement one branch at a time from updated main, in that order.

Finish annotations, triage #139 and satisfy #16/#28 release gates, then complete #19 and publish the major release through existing delivery. The v2.0.0 target is provisional. Advanced delivery #26/#32/#44 and staging/gate completion #129/#130 follow the major release under Roadmap 3 #107 Preparation; they are not blanket Roadmap 2 closure prerequisites. Reproduced release-blocking publishing defects still require triage. Future milestone reassignment is owner-managed.

Wiki adoption #146 defines the page structure and migration plan in [Wiki roadmap plan](wiki-roadmap-plan.md). Wiki publication is pending; repository roadmap documentation remains in use until published Wiki pages are verified. Earlier contradictory scope or milestone checkpoints below are historical and superseded.

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

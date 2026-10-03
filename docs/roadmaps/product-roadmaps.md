# PaperTrail release roadmaps

## Current roadmap ownership — 3 October 2026

[Roadmap 2 scope and milestones](roadmap-2.md) → [progress tracker](../trackers/progress.md). [Roadmap 3](roadmap-3.md) owns #17/#18. Desktop #4/#23/#27 stay deferred separately. First-release #1 is completed; [release records](../releases/README.md) preserve evidence. Earlier planning entries below are historical and superseded by these current roadmap guides.

## Delivered workflow refinement — #100 (historical validation notes)

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Browser E2E uses whole-PR changed-path filters. Automatic Browser E2E runs only when an eligible PR transitions from draft to ready for review (`ready_for_review`). Docs/tracker-only PRs are excluded. Opening, updating or reopening a PR does not trigger Browser E2E, even when it is already ready for review; use manual dispatch to validate later commits. Application/test/dependency/workflow changes remain eligible at the readiness transition. No automatic main Browser E2E trigger is added. Manual dispatch bypasses path/draft filtering. GitHub path filters consider only the first 300 changed files; unusually large PRs require deliberate manual Browser E2E. Browser E2E must remain optional, not a branch-protection-required check, because a filtered-out workflow cannot satisfy a required check.

Publication still checks source SHA/run identity, current-main eligibility, stale-build protection, aggregate preview preservation and retirement. Main CI does not cancel an active main publication when another push arrives; PR CI remains cancelable. GitHub's one-pending-run concurrency limitation remains #44, not solved here. Automatic deployment appears under Frontend CI → Publish validated production build / publish; standalone Publish website now denotes manual dispatch. Failed frontend validation cannot call publication. No duplicate production build is introduced.

Validation: nine pipeline tests pass locally, including real Git diffs for docs-only/application changes and source→docs renames, workflow dependency/permission boundaries, current-run binding, whole-PR mixed changes, manual dispatch and existing artifact/preview safeguards. Remote draft CI and review-ready Browser E2E must pass before review. Actual docs-only/main/preview behavior requires post-merge run evidence before #100 closes. #106 documentation reorganization follows; no files are moved in this implementation.

## First release — v1.0.0

[Roadmap #1](https://github.com/HimanshuHD/papertrail-reader/issues/1) now covers the first major release of the delivered browser PDF reader. It is completed after bug acceptance, production verification and stable v1.0.0 publication.

Delivered scope includes local folder/file selection, directory tree, responsive independently scrolling panes, selectable PDF text, page navigation, zoom/fit, contents, search, fullscreen, keyboard shortcuts, themes and compact accessible controls. PDF documents remain on the device. Password-protected files show an unsupported message; password entry is not implemented.

The deployed version is 1.0.0 at b2eb932; the published v1.0.0 tag targets the same reviewed merge. #79/#80/#1 are completed.

| Gate                                     | Issue           | Completion evidence                                                     |
| ---------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Collect and agree bugs                   | #79             | Reproduction, environment, severity and agreed first-release fix list   |
| Fix release blockers                     | Children of #79 | Linked fixes/PRs, passing checks and post-merge verification            |
| Final regression and support declaration | #79 / #80       | Tested browser/capability list, PDF smoke results and known limitations |
| Prepare first major release              | #80             | Reviewed commit, version 1.0.0, release notes and tag/release           |
| Verify and finish Roadmap 1              | #80 / #1        | Production version/source evidence and reconciled tracker               |

See [first-release bug tracking](../trackers/first-release-bugs.md). Record independently actionable defects as linked children, grouping symptoms only when they share a cause. Existing completed fixes do not become new blockers. No new reproducible defect is assumed by this planning change.

A reported defect may be promoted from deferred scope if it breaks the agreed first-release product. Existing #44 is a deferred infrastructure recovery issue; assess current reproduction and release impact during triage rather than duplicating it.

## Product Roadmap 2

See [current Roadmap 2 milestones](roadmap-2.md) and [the issue tracker](../trackers/progress.md). Preparation #100/#106/#112 is concluded by owner acceptance. Reading continuity #114/#117/#118 is merged; #115 bookmarks is completed under #13, followed by #14, EPUB #12, annotations #15, reliability #16/#28 and release delivery #19/#26/#32/#44. Multiple-document workspace #17/#18 is assigned to [Roadmap 3 #107](roadmap-3.md). Desktop #4/#23/#27 remains separately deferred.

## Reconciled delivery

- #2/#3/#5/#6/#7/#8/#9/#10/#11: original foundation and PDF scope delivered.
- #61/#62/#63/#72: browser acceptance, bounded panes and library refinements delivered.
- #64/#74/#75/#76: utility panel, toolbar/popover feedback and slider removal delivered in PR #73.
- PR #77 completes #10's direct render-cancellation and session-teardown acceptance evidence.
- Completed tooling/delivery issues remain checked in #1; unfinished issues above belong to #78.

PR #73 merged as 058195008dca9fc6797f035c272801fdd5f0d0f9. PR #77 merged as b41d3799bd41f278b50e1a39435dc41e7e9b41bc. Main CI 37006040941 and production publisher 37006094713 passed after #77; metadata identifies that source. Browser E2E 37005756245 passed all 45 Chromium checks before merge.

## Working policy

Reference issues in commits and PRs. Keep implementation PRs draft until lint/format/unit/type/build checks pass; Ready for review runs explicit Browser E2E. Ordinary CI stays browser-free. Previews are manual; successful main builds publish automatically. Reconcile live issues and docs after merges. Release publication follows #80 after the agreed bugs are finished.

The [earlier roadmap PDF](PaperTrail-Web-First-Roadmap.pdf) is a historical planning snapshot. This document and issues #1/#78 are authoritative for current scope.

Large-document performance: #95 follows #94 under #79/#88 in PR #90. Replace blocking all-page preview warm-up with viewport-driven rendering and a bounded reusable cache before first-release acceptance. The affected 1,000+ page PDF needs owner preview validation; first release remains blocked by #79.

Post-merge #90 reconciliation: #88/#91–#95 are completed; production metadata identifies c191353 and CI 37033803318 after successful publisher 37033885573. #84 is active, followed by #85/#86/#89/#87. #79 and the first-release gate remain open; version 1.0.0 is not yet prepared.

Post-merge #96: #84 completed; main CI 37036588000 and publisher 37036656072 passed with production metadata identifying a35e2c5. #85 centered loading feedback is active, then #86/#89/#87. First release gates remain open; EPUB remains Roadmap 2 scope.

## Current reconciliation — merged #97

PR #97 merged as f44d67517ba17053d15e4b420372526a5002a10c. Final Frontend CI 37040435175 passed 83 unit and 6 pipeline tests plus lint/format/types/build. Browser E2E 37040700001 passed 71 checks without retries (four intentional duplicate long-document skips). Main CI 37041483607, reconciliation 37041484160 and production publisher 37041555992 passed; production metadata records f44d675 and source CI 37041483607. Screenshot documentation is being preserved with the combined #86/#87 PR. #85 is completed; #79/#1/#80 remain open. #86 and #87 are the current combined increment; #89 and final regression remain before release.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](../evidence/reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## Deferred publishing chore — #100

Roadmap 2 #78 owns #100: prevent documentation-only merges from creating Publish website runs. The current workflow starts after successful main CI, then skips deployment for docs-only inputs. Owner explicitly deferred event-level filtering/orchestration until the next roadmap; #100 is not a v1.0.0 blocker. Current workflow triggers remain unchanged during #89.

## #89 validation — PR #101

PR #101 application/test 48c4295 passed Frontend CI 37050069997 (87 unit, 6 pipeline tests, lint/format/types/build) and Browser E2E 37050221708 (81 passed without retries; four intentional duplicate long-document skips). All five search cases passed at 320/375/768/1024/1440 widths, including independent canvas-ink alignment. The final selected-occurrence screenshot was visually inspected and is preserved in [search-highlighting.md](../evidence/search-highlighting.md). An earlier DOM-only alignment test missed displaced native text; the PDF.js CSS contract was corrected. A later test incorrectly required every fit change to keep a selected match visible; visibility is required on result clicks, while fit/zoom retains the existing reading point and preserves alignment. These initial results are superseded by the clean final run. No automatic PR publisher ran. Keep #89/#79 open for manual preview acceptance/merge and final first-release regression. Publish website on main with pr_number 101. #100 remains deferred under Roadmap 2 #78; workflows and version 0.1.0 are unchanged.

## Current reconciliation — merged #101

PR #101 merged as 77b8f311a638ba616a19dea0102833167a5453fa. #89 is completed. Main CI 37050685881, issue reconciliation 37050685625 and publisher 37050755788 passed; pages-state metadata identifies production 77b8f31/source CI 37050685881 and preview #101 is retired. This verifies deployment/source metadata, not an additional interactive production audit. Final application/test 48c4295 passed CI 37050069997 (87 unit, 6 pipeline tests) and Browser E2E 37050221708 (81 passed without retries, four intentional duplicate long-document skips). The selected-occurrence screenshot confirms alignment with painted PDF text. Final documentation evidence follows separately because #101 was merged during recording. #79/#1/#80 remain open for final first-release regression and v1.0.0 preparation; version remains 0.1.0. Chore #100 stays deferred under Roadmap 2 #78.

## v1.0.0 release candidate — #79/#80

All agreed first-release bug groups are merged. The owner confirmed affected-PDF Windows Chrome scrollbar/page/navigation/zoom-fit acceptance on 3 October 2026. The closed-issue audit covered all 46 closed issues and reconciled 59 stale unchecked entries across 13 issues, preserving superseded preload/theme/demo/CI scope accurately. Release preparation is on release/1.0.0: package/lockfile/footer source 1.0.0, changelog and [release records](../releases/README.md). Fresh candidate CI 37053609695 and Browser E2E 37053754669 passed on 31ef715 (87 unit, six pipeline and 81 browser checks without retries; four intentional skips). #79 acceptance is complete and handed off to #80; #80/#1 remain open through reviewed merge, main publication, exact v1.0.0 tag/GitHub release and production verification. Current production remains 0.1.0 / 77b8f31. Roadmap 2 #78/#100 is unchanged.

## Current v1.0.0 deployment reconciliation — merged #103

PR #103 merged as b2eb9328be5147346926e9bbce0960fa777b9e00. Main Frontend CI 37054802868 passed 87 unit/six pipeline tests, lint/format/types and the v1.0.0 production build. Reconciliation 37054803201 and publisher 37054875000 succeeded; Pages upload/deployment ran successfully. Deployment state identifies production b2eb932/source CI 37054802868. The owner confirmed the main deployment footer shows v1.0.0 and SHA b2eb932 on 3 October 2026 (Asia/Kolkata). This is owner UI verification plus source/workflow metadata, not a new exhaustive production browser audit. Final explicit candidate Browser E2E 37053754669 passed 81 checks without retries (four deliberate duplicate long-document skips). Branch inventory contains only main and pages-state; the merged release/1.0.0 branch is already removed. No v1.0.0 tag or GitHub release exists yet; #80/#1 remain open only for tagging/release and final ledger reconciliation. #79 is complete; Roadmap 2 #78/#100 remains deferred until that handoff.

## Final release reconciliation — 3 October 2026

Published stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) at 2026-10-02T19:55:40Z (3 October 2026, 01:25:40 Asia/Kolkata). GitHub API verifies the lightweight tag directly targets reviewed/deployed merge b2eb9328be5147346926e9bbce0960fa777b9e00. Main CI 37054802868 and publisher 37054875000 passed; owner confirmed production v1.0.0/SHA b2eb932. #79, #80 and first-release roadmap #1 are completed. Roadmap 2 #78 is open and ready; PDF saved positions/bookmarks #13 is the next feature, with #100 publishing maintenance retained as unfinished scope. Historical pending-tag and deferred-handoff entries are superseded by this verification.

Merged documentation PR #104 passed main CI 37056086312 and reconciliation 37056086941. Publisher 37056172706 succeeded with upload/deploy/URL steps skipped for docs-only input. Production remains b2eb932/source CI 37054802868. Tag/release publication created no additional Actions run in the reviewed latest-run listing. #100 retains event-level docs-only publisher filtering for Roadmap 2.

---

[Documentation home](../README.md) · [Next](roadmap-2.md)

## Bookmark merge and next increment — 4 October 2026

#120 merged as `0b2b5c1`; owner confirmed validation. #115 is completed and its active status label is removed. PDF increments #114/#117/#118/#115 are completed; #13 stays open only for separate format acceptance after #12. Preparation milestone 1 is confirmed closed through #100’s embedded milestone metadata. Reading continuity milestone 2 stays open for #14 and unfinished format scope. Next branch: `feat/14-recent-library-search`, from reconciled main. Prior pending-review/milestone-closure statements are historical and superseded.

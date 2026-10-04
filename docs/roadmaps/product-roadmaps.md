# PaperTrail release roadmaps

## EPUB contents/typography merge reconciliation — #135

Owner verified the controls and seven review observations, then merged [PR #135](https://github.com/HimanshuHD/papertrail-reader/pull/135) as `e9d59f424c78e62a94be316dc68a860d0fe8c27f`. #131 is completed/closed; its stale active label is removed. Accepted source `4be9aa0` passed [Frontend CI 37217580155](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37217580155): 189 unit/component tests, 10 pipeline tests, lint/format/types/build. Merge automation reconciled main as `3d5b97a`; owner verification is recorded separately from deferred release browser evidence.

Delivered: validated nested EPUB 2/3 Contents with spine fallback, PDF-style utility buttons/right panel, measured default font and responsive typography, stable loading overlay/metadata, iframe dismissal/tooltips, Text-only switch and borderless side icons. Full Browser E2E remains #134/#28 on reviewed release-to-main readiness; no new browser run is claimed.

## Active EPUB enhancement — #134

#132 is completed in merged #136. #133 is completed in merged #137. #134 is active on test/134-epub-release-acceptance, with browser execution from release/epub-acceptance-134 → main. Milestone 3 remains open with two open and eight completed issues.

## Planned EPUB reader enhancements — 4 October 2026

Parent [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) now has four separately tracked increments, **type:enhancement** (#131 completed; #132 completed; #133 completed; #134 in progress) in EPUB milestone 3. Each has explicit acceptance, dependencies and a planned branch name. #134 is the active acceptance gate; full browser execution remains a release gate.

| Issue                                                              | Enhancement                                             | Branch                                      | Status                           |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| [#131](https://github.com/HimanshuHD/papertrail-reader/issues/131) | authored contents navigation and typography controls    | `feat/131-epub-contents-typography`         | Completed                        |
| [#132](https://github.com/HimanshuHD/papertrail-reader/issues/132) | stable reading location through typography and resize   | `feat/132-epub-stable-location`             | Completed                        |
| [#133](https://github.com/HimanshuHD/papertrail-reader/issues/133) | identity, saved positions, bookmarks and recent history | Planned: `feat/133-epub-reading-continuity` | Completed                        |
| [#134](https://github.com/HimanshuHD/papertrail-reader/issues/134) | final format, security and browser release acceptance   | Planned: `test/134-epub-release-acceptance` | In progress — release acceptance |

Deliver #131 → #132 → #133 → #134. Create each later branch from updated main after prerequisite merges/deployments. #134 owns EPUB-specific release evidence and coordinates broader supported-browser gate #28; full browser execution stays on reviewed release-to-main readiness. EPUB milestone 3 remains open with four open and six closed issues.

## EPUB renderer merge reconciliation — 4 October 2026

[PR #125](https://github.com/HimanshuHD/papertrail-reader/pull/125) merged as `f9c170329109f9c7ed7ffbff9df0a41e265135b8` at 14:42:21 Asia/Kolkata. Owner deleted `feat/12-epub-rendering`. #124/#126/#127/#128 are completed; stale active labels and pending-merge checklist entries are removed. Source `66ea167` passed [Frontend CI 37190427689](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37190427689): 172 unit/component tests, 10 pipeline tests, lint, formatting, strict types and production build.

Delivered: formatted local styles/images by default, an unchecked **Text-only view** option retaining chapter/reading point where available, fixed side chapter icons, visible **Chapters** label, and mounted-frame resize with a trailing **150 ms** debounce and one vertical scroll owner. No further feature implementation is started by this reconciliation.

| Issue | Delivery                                               | Status            |
| ----- | ------------------------------------------------------ | ----------------- |
| #124  | Verified local renderer and session lifecycle          | Completed in #125 |
| #126  | Resize/reflow and horizontal-scroll correction         | Completed in #125 |
| #127  | Fixed side icons and Chapters label                    | Completed in #125 |
| #128  | Formatted default and optional text-only mode          | Completed in #125 |
| #12   | Contents, typography, CFI/identity and EPUB continuity | In progress       |

Fresh browser evidence for these corrections is deferred to [release acceptance #28](https://github.com/HimanshuHD/papertrail-reader/issues/28) and parent #12. That checklist retains both-mode resize/overflow, fixed-control/focus layout, representative EPUB 2/3 styles/images, mode anchors, hostile resources and mobile/desktop light/dark captures. Historical text-only screenshots/run do not validate current formatted/resize behavior. Browser E2E executes only on reviewed `release` or `release/*` → `main` opening/readiness; feature work uses ordinary CI.

EPUB milestone 3 is verified **open**, with five open issues (#12 and #131–#134) and five closed issues. Preparation milestone 1 and Reading continuity milestone 2 are closed. Roadmap #78 remains open for subsequent EPUB, annotations, reliability/browser and delivery scope.

#129 was unintentionally closed by a negated closing-keyword reference in #125's description; it is reopened/status:new per owner instruction. The merged workflow prototype does not complete its formal release/staging event acceptance. #130 staging delivery remains new/unimplemented. Both remain Roadmap 3 #107 Preparation planning; actual milestone assignment is pending identification/creation. No staging deployment behavior has changed.

Earlier entries below preserve historical checkpoints and are superseded by this current reconciliation.

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

## Owner scope and sidebar reconciliation — 4 October 2026

#13 is closed completed: PDF identity, positions, view/anchor restoration and bookmarks are accepted in merged #116/#119/#120. EPUB/CFI and format-specific persistence remain owned by #12 in EPUB milestone 3; they do not block #13. Earlier notes retaining #13 for EPUB are historical and superseded. Reading continuity milestone 2 stays open for #14 only.

#14 owner feedback remains in PR #121: Recent is a collapsible component with a leading clock icon and trailing count; search sits immediately below the Library header with exact `Search documents...` placeholder and a search icon. Visible search label/help and empty recent-history copy are removed; accessible naming/live result count and recovery actions remain. Full validation is running; do not start the next item before owner acceptance.

## #131 UI refinement in PR #135

Replaces the duplicate Chapters dropdown with Contents alone. The PDF-style utility bar uses shared icon buttons; Contents toggles a right utility panel (docked on wide reader areas, overlay on narrow ones). Typography opens a compact popover with font −/+, segmented spacing/width choices and Reset. Escape/close focus restoration, outside-popover dismissal and reduced-motion/inert transitions are covered by component regressions; mode/source ownership and fixed side chapter controls remain. Later Bookmarks/features extend this utility area under #133. Release browser fixtures use the revised controls; execution remains deferred to #134/#28.

## #131 review observations: loading and controls

Chapter/mode loading is contained in a fixed reading-stage overlay with a 150ms delayed loader; Contents metadata remains visible and stable. Book default shows the measured chapter text size and its numerical duplicate is excluded from font stepping. Width choices use mobile/tablet/desktop-style measures: Narrow at 50% capped to 480px, Medium at 70% capped to 768px, Wide at 90% capped to 1100px. Mobile windows below 640px have no width choices; tablet windows below 1024px omit Wide. Full width remains distinct. Iframe pointer/Escape listeners dismiss Typography and are cleaned up; top utility tooltips stack above the popover. Text-only is an accessible switch, and fixed chapter controls are borderless icons with subtle hover/focus interaction. Unit regressions and deferred browser fixtures track these observations; full visual execution remains the release gate.

## #132 implementation checkpoint

Session location capture/restoration is implemented with validated generated-publication CFIs and character/text anchors, pixel offsets and end-of-chapter handling. Typography, 150ms resize and mode reopening preserve the reading point with generation/input cancellation. Local checks pass: 197 unit/component tests, 10 pipeline tests, lint/format/types/build. Delivery awaits review and owner merge; the milestone remains open with four open and six completed issues. The release suite lists 140 cases; current browser execution remains #134/#28. See [location semantics](../architecture/epub.md#stable-session-reading-location--132).

## #136 merge reconciliation and active #133

Owner merged #136 as `09610e6` after source `2f99f6b` passed Frontend CI 37223881477 (197 unit/component and 10 pipeline tests, lint/format/types/build). #132 is complete and its active label is removed. #133 now owns saved EPUB progress across reload, document switching and later reselection, plus identity/settings/bookmarks/recent history. Its fresh branch starts from updated main; #134 remains new for final release evidence. EPUB milestone 3 remains open: three open (#12/#133/#134), seven completed. Browser E2E remains deferred to reviewed release-to-main readiness.

## #133 implementation checkpoint

Saved EPUB progress across reload/document switching/reselection is implemented, with content identity, typography/mode, named bookmarks and format-aware recent/workspace recovery. The new EPUB database remains separate from PDF metadata and stores no file bytes. Local validation passes 206 unit/component and 10 pipeline tests, lint/format/types/build. Release fixtures list 145 cases; browser execution remains deferred to #134/#28. Review and owner merge remain pending. Milestone 3 remains open with three open and seven completed issues. See [continuity semantics](../architecture/epub.md#saved-epub-reading-continuity--133).

## #137 merged; final EPUB acceptance — #134

Owner merged #137 as `d7afbf58cf9448749bbd226018956035c5576076`. Accepted source `ec4f995` passed Frontend CI 37225710749: 206 unit/component and 10 pipeline tests, lint/format/types/build. #133 is completed and its stale active label is removed. #134 now owns final reviewed release-candidate checks and current evidence. EPUB milestone 3 remains open: two open (#12/#134), eight completed. #12 and the milestone remain open until the remaining acceptance is verified. Broader Chrome/Edge/Firefox/Safari capability declarations stay in #28. Earlier pending merge and active-increment checkpoints are historical.

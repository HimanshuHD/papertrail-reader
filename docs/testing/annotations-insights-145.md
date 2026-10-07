# Annotations and insights release acceptance (#145)

Preparation is active; execution and completion are pending. Parent #15, roadmap #78 and milestone 4 remain open. Owner verified and merged PR #159; final application source `b997a247f15adb057261a487ab0cfa54bbc77ea6` passed Frontend CI 37562511277 and 300 unit/component tests plus 10 pipeline tests and required checks. Owner verification does not replace this release gate.

## Candidate and execution

1. After #159 merges, confirm #140–#144 and #157 are closed and reconcile their status labels. Create one `release/145-annotations-insights` branch from updated main; record its exact base and candidate source.
2. Review existing browser cases against the matrix below and add missing statistics lifecycle cases before review. Current browser fixtures include PDF/EPUB highlight and note lifecycle coverage; Reading insights cases now cover native IndexedDB checkpoints/reload/reset, virtual-time idle recovery, synthetic page lifecycle pauses, EPUB iframe interaction and both-theme annotation counts/link/reset preservation. OS window-switch delivery and cross-tab reset/error injection still require explicit acceptance. Type-check fixtures and run required local checks.
3. Open the release-to-main PR as draft for preparation. Mark it ready only with candidate fixtures/fixes complete. The workflow accepts `release` or `release/…` heads targeting main, on opened/ready_for_review events; updates alone do not trigger it. Use a draft-to-ready transition for a corrected candidate. Full Browser E2E runs here, not on feature branches.
4. Record exact source and tested merge checkout, browser/OS/Node versions, pass/fail/flaky/skip counts, run/artifact links and expiry. Inspect both-theme screenshots after transitions settle. Preserve durable curated evidence before the seven-day artifacts expire.
5. Triage failures through #139; correct release blockers on this candidate and rerun on the corrected revision. Reconcile #145/#15/#78/#19 only with actual results. Broader #16/#28 and major release #19 remain separate gates.

## Acceptance matrix

| Area                      | Required cases                                                                                                                                | Current evidence / next action                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PDF selection             | Wrapped lines, columns, margins/gaps, backwards/cross-page, outside release, zoom/rotation/virtualization                                     | Existing fixture and owner checks; inspect native geometry and retained selection                                                |
| EPUB highlights           | Formatted/text-only, chapter changes, reflow/typography, reload, unsupported/unresolved anchors                                               | Existing lifecycle fixture; inspect same/distant chapter navigation                                                              |
| Notes and panel           | Create highlight with note atomically, edits, independent deletion, filtering, color preview versus explicit save, safe plain text            | Existing lifecycle coverage; inspect menus, marker placement, dismissal and viewport edges                                       |
| Annotation counts         | Saved full-document highlights and non-empty notes, live add/edit/delete, no drafts, document isolation, loading/unavailable, See annotations | Browser lifecycle fixtures now exercise counts, panel link and reset preservation; execution pending                             |
| Timing                    | Foreground/ready only, idle cutoff, activity including EPUB iframe, hidden/blur/loading, repeated window switching                            | Browser fixtures exercise virtual-time idle and synthetic lifecycle events; OS window switching remains an explicit manual check |
| Persistence/reset         | Cumulative reloads, rename/content isolation, current/furthest position, statistics-only reset, cross-tab stale generation                    | Browser fixtures exercise native checkpoints/reload/reset; cross-tab and failure cases remain explicit checks                    |
| Failure and accessibility | Storage rejection/retry, unsupported schema preservation, keyboard/focus/Escape, malicious note text, fullscreen                              | Verify fixture coverage and add gaps; retain truthful failure states                                                             |
| Visual/responsive         | Both themes at 320/375/768/1024/1440px, readable highlight contrast, no stray overflow or popover clipping                                    | Inspect current candidate screenshots; historical screenshots are not current acceptance                                         |

PDF position is page position; EPUB position is chapter position. Neither implies completion. Page-close flushing is best effort; do not claim hard-termination durability. Chromium workflow evidence must identify its tested browser and cannot certify untested browsers under #28.

## Evidence checklist

- [ ] All implementation dependencies merged; candidate/base recorded.
- [x] Initial Reading insights browser cases added and fixtures type-checked; remaining native/manual matrix gaps stay explicit.
- [ ] Reviewed release Browser E2E passed; failures/flaky cases/skips explained.
- [ ] Current-source visual, focus and failure evidence inspected and retained.
- [ ] Results linked and issue/roadmap/release checklists reconciled.

## First release-run corrections

Run 37563128629 failed: 27 failed, 3 flaky, 147 passed and 8 intentional skips. It exposed stale dark-page color/search-panel assertions, hidden-library reload reselection, annotation navigation/editor timing and a real idle-resume gap for PDF utility-panel interactions. Utility panels now explicitly report reader activity; annotation popovers reserve their owning panel header so Close stays reachable. Reload helpers show the library before reconnecting sources, expanded editors dismiss via Escape before view changes, selection waits for fonts/layout, and EPUB scrolling waits for reflow. These corrections require a fresh candidate run; prior results do not certify acceptance.

## Second-run fixture corrections

Run 37565053738: 167 passed, 10 failed, 8 intentional skips; no flaky outcomes reported. Build/browser setup/artifact upload succeeded. Remaining failures repeated two fixture assumptions at all five widths: success is announced by the shared toast rather than panel-local text, and PDF restores its saved Reading insights mode so blindly clicking its toggle closes it after reload. The fixture now checks the toast plus saved note content, and opens insights only when its toggle is not expanded. No application behavior or assertion coverage is removed. A fresh candidate run remains required.

## Coverage expansion after passing run 37566080108

The prior candidate passed with 176 passed, one retry-dependent PDF Edit note case at 1024px and eight intentional skips. Popover dismissal previously reacted to every document scroll, including sibling PDF rendering scrolls that do not move the panel anchor. It now dismisses for anchor-container/document scrolling, repositions for unrelated panes and preserves inside-popover scrolling. Unit and browser regressions exercise this distinction.

New browser coverage adds native forward/backward PDF margin/outside-page dragging, shared excerpt/note/color/notes-only filters, EPUB color-only preview before explicit save, live EPUB counts after note/highlight deletion, actual second-tab UI statistics reset with stale-generation rejection/retry, and blocked statistics storage with usable readers/recovery for both formats. Cases run across all five configured widths. Execution on the expanded candidate remains pending.

Coverage still requires follow-up for cross-page/native drag permutations at rotated zoom levels, exact distant-highlight top offset, unsupported schema preservation/quota refresh failures, unsaved draft/count isolation permutations, complete border/hover/marker visual checks, and OS focus-window delivery. These are not marked automated or accepted by this increment. Non-Chromium acceptance remains #28.

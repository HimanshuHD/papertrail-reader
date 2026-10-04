# EPUB release acceptance — #134

Candidate acceptance remains pending. First source `4375fb4` passed Frontend CI 37226881921 but browser run 37226881578 had 133 passed, 16 failed, 3 flaky and 8 intentionally skipped cases. Corrected source `1c5d74cbcedbdec5e093d6a7fd6c7a40f3235271` passed Frontend CI 37228118345; browser run 37228117456 improved to 147 passed, 4 failed, 1 flaky and 8 intentionally skipped. Header spacing, settled resize and mobile popover checks passed. Remaining failures concern logical character preservation across sequential reflows/mode changes. A further fix retains the restored logical anchor until user scrolling; its focused regression passes.

Run 37228117456 recorded Chromium `153.0.8010.12`, Node `v24.21.0`, Linux, and tested PR checkout `696bc32aa30b4a6e8e91aa4455b91c055aa7f317`. Compact artifact 11312612168 contains screenshots, JSON and the inspected failure trace; full report 11312397712 expires 11 October 2026. These are diagnostic evidence, not final acceptance.

| Area                                                                    | Evidence route                                                                   | Current status                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| EPUB 2/3 Contents and sanitized styles/images                           | NCX/nav, formatted fixture, security checks                                      | Pending browser results           |
| RTL, wide tables, grid layout, long tokens                              | EPUB 2/3 release fixtures in both modes                                          | Pending browser results           |
| 150ms resize, typography, utility/library widths and CFI/text locations | Retained-frame and long-paragraph checks                                         | Pending browser results           |
| Reload/reselection/rename/changed content, settings, bookmarks/history  | EPUB continuity fixture and metadata unit tests                                  | Pending browser results           |
| Unsupported/corrupt books and storage failure                           | Browser recovery fixtures and adversarial bounded unit cases                     | Pending browser results           |
| Resource cleanup and stale operations                                   | Unit tests for URLs, navigation, abort/disposal; browser source/mode transitions | Unit checks pass; browser pending |
| PDF/library/workspace regressions                                       | Full shared release suite, native persisted PDF handle                           | Pending browser results           |
| Light/dark mobile/desktop layout                                        | Current screenshots at 320/375/768/1024/1440px                                   | Capture/inspection pending        |

The workflow records candidate source, tested PR merge checkout, Node/OS and exact Chromium version in `browser-evidence/environment.json`, and machine-readable outcomes in `browser-evidence/results.json`. Reports, screenshots and retained failure traces share the browser-review artifact. Browser E2E executes through reviewed release-to-main readiness only. Fixes require draft → updated candidate → ready transition.

This is headless Linux Chromium with viewport emulation. It does not certify Chrome, Edge, Firefox, Safari, mobile operating systems or real devices. Broader version/capability acceptance remains #28. Fixed-layout/encrypted books, embedded fonts, active/media/remote content and complete EPUB conformance remain outside the supported reflowable subset. Page-exit metadata persistence is best effort. EPUB CFIs refer to generated sanitized chapters.

#12 and milestone 3 stay open until final acceptance and owner merge. The milestone currently has two open issues (#12/#134) and eight completed issues.

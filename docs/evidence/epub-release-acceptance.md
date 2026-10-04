# EPUB release acceptance — #134

Candidate: release PR #138, source `4375fb4478ee915f147ad89fea6b647012ae15ce`. Frontend CI 37226881921 passed. Browser E2E 37226881578 completed with 133 passed, 16 failed, 3 flaky and 8 intentionally skipped cases. EPUB spacing, resize timing, popover interaction and reading-position failures require a corrected candidate and a fresh run; screenshot inspection remains pending. No current-source browser acceptance is claimed in this checkpoint.

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

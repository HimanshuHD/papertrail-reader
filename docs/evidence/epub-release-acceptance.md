# EPUB release acceptance — #134

Accepted application/test source: `3e4fef13c7934aec32903bfe4a5dd9109f894a30`, release PR [#138](https://github.com/HimanshuHD/papertrail-reader/pull/138). [Frontend CI 37229583694](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229583694) passed 206 unit/component tests, 10 pipeline tests, lint/format/types/build. [Browser E2E 37229662269](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229662269) passed **152**, skipped eight intentionally, and had **zero failures/flaky cases**. All 50 EPUB cases passed across 320/375/768/1024/1440px; 102 other shell/PDF/library cases passed.

The tested PR merge checkout is `a69d898c12eb44a0a46a801a282bffa9e8ef3dd2`. Runtime: headless Linux Chromium **153.0.8010.12**, Node **v24.21.0**. Later evidence/docs-only commits retain these exact tested application and fixture bytes. [Persisted identity and outcomes](epub-134/acceptance-summary.json) records all 160 case outcomes. Four duplicate long-PDF and four duplicate native-handle viewport cases are skipped; both costly regressions execute once at 1440px.

| Area                                                                    | Evidence                                                                                               | Outcome                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| EPUB 2/3 authored Contents, sanitized styles/images                     | NCX/nav, authored formatting/images and hostile input fixtures                                         | Passed                                                                                      |
| RTL, wide tables, grid layout, long tokens                              | EPUB 2/3 fixtures in formatted/text-only modes at every width                                          | Passed; narrow adversarial cells wrap extensively                                           |
| 150ms resize, utility/library widths, typography and CFI/text locations | Retained iframe and long-paragraph character-offset checks                                             | Passed without horizontal scrollbars/blank or replaced frames                               |
| Reload/reselection/rename/changed content, settings, bookmarks/history  | EPUB continuity fixture and metadata tests                                                             | Passed                                                                                      |
| Unsupported/corrupt books and storage failure                           | Browser recovery plus bounded adversarial unit cases                                                   | Passed                                                                                      |
| Scripts, remote requests and resource ownership                         | Browser request/sanitization assertions; bounded processing/abort/disposal unit cases                  | Passed                                                                                      |
| PDF/library/workspace regressions                                       | Complete shared release suite including long PDF and native persisted handle                           | Passed                                                                                      |
| Light/dark mobile/tablet/desktop layout                                 | 50 final EPUB captures; contact sheets inspected at all five widths and representative full-size views | Inspected; settled Contents overlays/docking, contained RTL/table content and side controls |

## Retained review evidence

[Full browser report/screenshots](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229662269/artifacts/11312793498) and [compact JSON/screenshots](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229662269/artifacts/11312898319) expire 11 October 2026. Curated originals remain in this repository:

| Capture                                 | Original                                    |
| --------------------------------------- | ------------------------------------------- |
| 320px Contents overlay, dark            | [PNG](epub-134/contents-mobile-dark.png)    |
| 375px authored RTL/layout/table, light  | [PNG](epub-134/formatted-mobile-light.png)  |
| 375px Text-only view, dark              | [PNG](epub-134/text-mobile-dark.png)        |
| 1440px Contents docked, dark            | [PNG](epub-134/contents-desktop-dark.png)   |
| 1440px authored RTL/layout/table, light | [PNG](epub-134/formatted-desktop-light.png) |

## Release corrections

Initial browser run 37226881578 had 133 passed, 16 failed, three flaky and eight skipped cases. Run 37228117456 improved to 147 passed, four failed, one flaky and eight skipped. Fixes updated obsolete EPUB-header opener spacing, waited for settled resize geometry and uncovered mobile popover dismissal, and retained the original logical character through sequential reflows/mode/persistence snapshots until user scrolling replaces it. The location service owns anchoring rather than competing with native scroll anchoring. A focused regression covers a changed first-visible-character after restoration. Run 37228983580 then passed 152 with zero flaky cases. The final rerun additionally waits for finite UI transitions before screenshots; perpetual loading spinners are excluded from that wait.

## Supported boundary and closure

This is headless Linux Chromium with viewport emulation. It does not certify Chrome, Edge, Firefox, Safari, mobile operating systems or real devices; broader version/capability acceptance remains #28. Reflowable local EPUB 2/3 is supported. Fixed-layout/encrypted books, embedded fonts, active/media/remote content and complete EPUB conformance remain outside the supported subset. Page-exit metadata persistence is best effort. EPUB CFIs refer to generated sanitized chapters.

#134 acceptance is evidenced and ready for owner review/merge in #138. #12 and milestone 3 stay open until that merge; the milestone has two open (#12/#134) and eight completed issues. The owner closes the milestone afterward. #129/#130 and later roadmap work remain separate.

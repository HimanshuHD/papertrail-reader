# Changelog

## 2.0.0 — PDF and EPUB reading library — deployed 8 October 2026

Owner approved release; #164 merged and production deployment succeeded on 8 October 2026. Stable [v2.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.0.0) published 8 October 2026 at 12:23:17 Asia/Kolkata, targeting exact #164 merge `d995c806d93725f990636ce0899388c613cb2bbb`. Packaging Browser E2E 37738585747 passed 307 cases with zero failures/flakes and 12 intentional skips.

Adds saved library/workspace state and reading positions, bookmarks and recents; formatted EPUB reading with Contents, typography and text-only controls; persistent PDF/EPUB highlights and notes with annotation navigation; local reading time and annotation counts; responsive independent utility panels and refined light/dark controls.

Owner completed #161 validation and #28 acceptance. Prior automated Browser E2E 37585840311 passed 307 cases with zero failures/flakes and 12 intentional skips. Final packaging evidence will be recorded separately. File access remains permission-based; document bytes are not copied into workspace storage. Broader performance budgets remain open under #16. Tabs, desktop, staging and advanced delivery follow later. See [release record](docs/releases/v2.0.0.md).

## 1.0.0 — First browser PDF release — deployed 3 October 2026

Responsive browser PDF reading with local folder/file selection, discovery/refresh, a resizable library, continuous selectable pages, navigation, zoom/fit, contents, fullscreen, keyboard help and light/dark themes. Search excerpts are bounded and highlighted; result clicks select exact PDF occurrences.

First-release fixes include buffered rendering, reading-point anchors, scrollbar page tracking, bounded preview caching and fast opening of 1,000+ page PDFs; single title/fallback labels, independent scrolling, centered loading feedback, accessible controls/popovers and a compact version/identity footer.

PDF-only. EPUB, OCR, password-entry UI, persistent positions/bookmarks, annotations, tabs, broader browser certification and Tauri remain outside this release. Documentation-only publisher trigger refinement is deferred as #100 under Roadmap 2 #78. See [release record](docs/releases/v1.0.0.md) and [acceptance audit](docs/releases/v1.0.0-acceptance-audit.md). PR #103 is merged and production v1.0.0 is verified at b2eb932 (main CI 37054802868, publisher 37054875000). Stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) was published on 3 October 2026 (Asia/Kolkata), at 2026-10-02T19:55:40Z, with the lightweight tag targeting that exact merge.

## 0.1.0 — Initial foundation

Initial browser-first PaperTrail foundation: Vue/Vite/TypeScript bootstrap, lint/type/unit/pipeline checks, manual PR previews and retirement, production publishing, linked deployment identifiers, Tailwind semantic light/dark tokens, Pinia preferences, hash routing and PDF/EPUB adapter contracts. Architecture and issue tracking documentation are established.

This increment adds the production version label (#47) and replaces System/Light/Dark selection with an accessible sun/moon Light/Dark toggle (#46).

Folder selection, reader shell, PDF/EPUB engines, reading persistence and product-release acceptance are planned subsequent work. 0.1.0 is the initial foundation version; it does not claim a complete document reader. Versioned release promotion remains #32.

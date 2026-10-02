# Changelog

## 1.0.0 — First browser PDF release (candidate)

Responsive browser PDF reading with local folder/file selection, discovery/refresh, a resizable library, continuous selectable pages, navigation, zoom/fit, contents, fullscreen, keyboard help and light/dark themes. Search excerpts are bounded and highlighted; result clicks select exact PDF occurrences.

First-release fixes include buffered rendering, reading-point anchors, scrollbar page tracking, bounded preview caching and fast opening of 1,000+ page PDFs; single title/fallback labels, independent scrolling, centered loading feedback, accessible controls/popovers and a compact version/identity footer.

PDF-only. EPUB, OCR, password-entry UI, persistent positions/bookmarks, annotations, tabs, broader browser certification and Tauri remain outside this release. Documentation-only publisher trigger refinement is deferred as #100 under Roadmap 2 #78. See [release record](docs/releases/v1.0.0.md) and [acceptance audit](docs/releases/v1.0.0-acceptance-audit.md). Tag/date/production v1.0.0 remain pending until the candidate is reviewed and merged.

## 0.1.0 — Initial foundation

Initial browser-first PaperTrail foundation: Vue/Vite/TypeScript bootstrap, lint/type/unit/pipeline checks, manual PR previews and retirement, production publishing, linked deployment identifiers, Tailwind semantic light/dark tokens, Pinia preferences, hash routing and PDF/EPUB adapter contracts. Architecture and issue tracking documentation are established.

This increment adds the production version label (#47) and replaces System/Light/Dark selection with an accessible sun/moon Light/Dark toggle (#46).

Folder selection, reader shell, PDF/EPUB engines, reading persistence and product-release acceptance are planned subsequent work. 0.1.0 is the initial foundation version; it does not claim a complete document reader. Versioned release promotion remains #32.

# EPUB implementation — #12

## In-place EPUB resize and release acceptance policy — 4 October 2026

The previous resize revision `c504c5f` passed CI but failed Browser E2E 37180276140: ten EPUB cases failed, 102 existing cases passed and eight were skipped. The engine resize path cleared the iframe before a location existed, leaving a blank chapter. This is a real regression; earlier pending/success wording below does not accept that revision.

The revised adapter uses fixed initial stage dimensions and an isolated epub.js 0.3.93 bridge to update the mounted scrolling view instead of clearing/redisplaying it. Available chapter width excludes the stable vertical scrollbar gutter, and resizing preserves visible text where a caret anchor is available. Regression coverage checks iframe identity across live resize, frame/body/container width and navigation. #126 remains open for release browser/owner acceptance.

#129 changes Browser E2E execution to reviewed `release` or `release/*` PRs targeting `main`, on opening or readiness transition only. Feature PR/browser dispatch no longer execute E2E. Major implementation continues with ordinary CI; final release acceptance records browser evidence. #127/#128 are still pending. Staging branches, preview restrictions and a stable staging deployment are proposed only; no staging deployment behavior has changed.

## Live EPUB resize correction — #126

PR #125 now observes the actual reader container and resizes the epub.js rendition on the next animation frame. Zero-size/unchanged layouts are ignored, resize work is deferred during explicit chapter navigation, and observer/pending-frame ownership ends on disposal. Chapter box sizing includes padding within available width; preformatted text wraps. The engine uses its current CFI when redisplaying after resize; persistent CFI storage remains later #12 scope.

Local checks passed: 165 unit/component and 10 pipeline tests, lint, formatting, strict types and production build. A browser regression narrows/widens the window without a scroll event and asserts iframe/container alignment, content overflow, paragraph reflow and retained chapter navigation. Fresh CI/browser acceptance is pending; the prior `f1f76da` run does not validate this revision. #126 stays open until browser acceptance and merge; #127/#128 remain pending, so #124/PR #125 are not yet complete.

## Current renderer increment — #124

Branch `feat/12-epub-rendering` builds on merged archive preflight PR #123 (`d5fdbdf`). The first reader opens local reflowable EPUB 2/3 chapter text through a lazy epub.js 0.3.93 adapter. Original book CSS, images, links and active content are omitted in this text-first increment; the reader explains this limitation. Fixed-layout and encrypted/obfuscated books are rejected. Chapter controls follow linear spine order; authored contents, CFI persistence, typography controls, bookmarks and recent EPUB history remain parent #12 acceptance.

`publication.ts` reads consumed ZIP resources in bounded slices, streams deflate input in 1024-byte chunks, enforces actual output sizes and verifies CRC32 before XML parsing. XML input limits are 256 KiB for the container, 1 MiB for the package and 4 MiB per chapter; total chapter input/output is limited to 32 MiB. Invalid UTF-8, entity/internal-subset declarations, missing/remote spine resources and excessive node depth/count fail before rendering. Standard XHTML HTML doctypes are stripped before parsing. Unique linear spine paths prevent repeated-resource work amplification.

Chapters are rebuilt into fresh XHTML trees using a tag allowlist. Attributes, scripts, styles, foreign namespaces, media, forms, embedded documents and original URLs never reach the engine. Images retain alternate text. A generated local package contains only generated chapter paths and inert text. Each chapter includes CSP with `default-src 'none'`, inline application styles allowed, and image/font/frame/connect/form/base sources denied. The engine's network request fallback is explicitly denied and its iframe permits same-origin access for layout, without scripts or popups. This is a text-rendering boundary, not general rich-publication sanitization or complete EPUB conformance certification.

`epub-session.ts` owns an isolated rendering root and engine. Aborting hides its root immediately; engine destruction waits for archive opening to settle, then removes only its own root. Once opened, abort releases the engine/root immediately even during pending navigation. `useEpubReader` coordinates source ownership, navigation, errors and unmount; `EpubReaderWorkspace` presents controls and follows the application's light/dark theme. PDF sessions and persistence remain independent. This increment adds no document-byte persistence and no automatic EPUB reopen after reload.

epub.js brings a legacy XML dependency; the lockfile overrides `@xmldom/xmldom` to 0.9.12. Publication XML parsing uses the browser DOMParser. Regression fixtures exercise stored/deflated entries, declared-size lies, CRC mismatch, hostile XHTML, source changes and engine rejection/disposal. Application/test source `f1f76da` passed Frontend CI 37175969681 and Browser E2E 37176268989: 164 unit/component, 10 pipeline and 107 Chromium browser cases, eight intentional skips, no failures/retries. See [recorded evidence and inspected captures](../evidence/epub-text-reader.md).

Parent [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) belongs to EPUB milestone 3. Reading continuity milestone 2 is delivered; its six issues are closed. The owner closes its GitHub milestone separately. EPUB does not reopen PDF #13.

## First increment: archive preflight — #122

`src/features/epub/archive-preflight.ts` inspects local Blob slices before any decompression. Fixed application policy limits archive size to 128 MiB, central directory to 4 MiB, entries to 4096, each declared expanded resource to 32 MiB, total declared expanded bytes to 256 MiB and expansion ratio to 200. These are product limits, not EPUB specification limits.

The service checks the end record, central directory and local-header agreement. It accepts stored/deflated entry metadata and signed/unsigned data descriptors; it rejects multidisk/ZIP64, encryption flags, unsupported methods, inconsistent offsets, overlap, duplicate paths, traversal/absolute/URL paths and ambiguous alternate filename fields. Names must be ASCII or explicitly UTF-8. Percent-encoded paths, query/fragment characters and archive prefixes/gaps are intentionally unsupported in this initial policy. The first stored resource must be the exact `application/epub+zip` mimetype, without local extra fields; a nonempty `META-INF/container.xml` resource must exist.

The bounded metadata check does **not** decompress resources, verify resource CRCs, parse container/package XML, certify EPUB conformance, block remote resources or authorize rendering. Declared sizes can lie: the future decompressor must independently enforce actual output limits and CRCs. The existing EPUB selection placeholder stays unchanged until a safe renderer is integrated. Cancellation is checked before/after reads and through directory traversal; document bytes/handles are never persisted by this service.

ZIP fields follow [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT). Container identity follows [W3C EPUB 3.3 OCF](https://www.w3.org/TR/epub-33/#sec-ocf). Reference implementation APIs: [epub.js README](https://github.com/futurepress/epub.js/blob/master/README.md). Dependencies are not added in the preflight increment.

## Remaining integration sequence

1. Introduce a lazy epub.js adapter, independent of Vue, with explicit open/destroy lifecycle and cancellation ownership. Enforce decompression output budgets and XML/package validity before rendering.
2. Constrain archive resource resolution, block remote fetches and document navigation, remove active content and apply a restrictive iframe sandbox/CSP before document insertion. Disabling scripts alone does not block remote images/styles or nested active content. Verify these boundaries with hostile fixtures and request interception.
3. Use a composable for async ownership, source changes and disposal. Present the adapter through a dedicated EPUB workspace component; keep PDF behavior and storage independent. Chapter/contents navigation and reflow controls belong to EPUB presentation.
4. Persist content identity, CFI and typography in versioned EPUB metadata services. Retain the same reading point after font/viewport changes; validate renamed/changed/unavailable files before reopen. Integrate format-specific bookmarks and recent history without saving EPUB bytes.
5. Validate representative EPUB 2/3 books, malformed archives and security fixtures at existing browser widths. Add other-browser acceptance when the supported-browser gate is reached. Keep #12 open until all format acceptance is met.

The initial archive unit suite uses adversarial byte fixtures and bounded read/cancellation assertions. There is no browser or EPUB reading acceptance claim for this foundation-only increment.

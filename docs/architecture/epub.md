# EPUB implementation — #12

## Current renderer increment — #124

Branch `feat/12-epub-rendering` depends on archive preflight PR #123. The first reader opens local reflowable EPUB 2/3 chapter text through a lazy epub.js 0.3.93 adapter. Original book CSS, images, links and active content are omitted in this text-first increment; the reader explains this limitation. Fixed-layout and encrypted/obfuscated books are rejected. Chapter controls follow linear spine order; authored contents, CFI persistence, typography controls, bookmarks and recent EPUB history remain parent #12 acceptance.

`publication.ts` reads consumed ZIP resources in bounded slices, streams deflate input in 1024-byte chunks, enforces actual output sizes and verifies CRC32 before XML parsing. XML input limits are 256 KiB for the container, 1 MiB for the package and 4 MiB per chapter; total chapter input/output is limited to 32 MiB. Invalid UTF-8, entity/internal-subset declarations, missing/remote spine resources and excessive node depth/count fail before rendering. Standard XHTML HTML doctypes are stripped before parsing. Unique linear spine paths prevent repeated-resource work amplification.

Chapters are rebuilt into fresh XHTML trees using a tag allowlist. Attributes, scripts, styles, foreign namespaces, media, forms, embedded documents and original URLs never reach the engine. Images retain alternate text. A generated local package contains only generated chapter paths and inert text. Each chapter includes CSP with `default-src 'none'`, inline application styles allowed, and image/font/frame/connect/form/base sources denied. The engine's network request fallback is explicitly denied and its iframe permits same-origin access for layout, without scripts or popups. This is a text-rendering boundary, not general rich-publication sanitization or complete EPUB conformance certification.

`epub-session.ts` owns an isolated rendering root and engine. Aborting hides its root immediately; engine destruction waits for pending engine operations to settle, then removes only its own root. `useEpubReader` coordinates source ownership, navigation, errors and unmount; `EpubReaderWorkspace` presents controls and follows the application's light/dark theme. PDF sessions and persistence remain independent. This increment adds no document-byte persistence and no automatic EPUB reopen after reload.

epub.js brings a legacy XML dependency; the lockfile overrides `@xmldom/xmldom` to 0.9.12. Publication XML parsing uses the browser DOMParser. Regression fixtures exercise stored/deflated entries, declared-size lies, CRC mismatch, hostile XHTML, source changes and engine rejection/disposal. Browser acceptance remains pending until the current PR run is recorded.

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

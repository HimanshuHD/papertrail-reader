# EPUB implementation — #12

## Current renderer — #124 / #126 / #127 / #128

PR #125 is merged as `f9c1703`, completing #124/#126/#127/#128 on top of archive-preflight PR #123. Source `66ea167` passed CI 37190427689 (172 unit/component and 10 pipeline tests, lint/format/types/build). Supported local reflowable EPUB 2/3 books open in formatted mode by default. The **Text-only view** checkbox removes author styles and illustrations; it starts unchecked for each source. The **Chapters** dropdown follows linear spine order. Previous/next icon buttons occupy 40px side gutters outside the scroll container, remain visible while chapters scroll, and provide accessible names, focus indication and first/last disabled states.

`publication.ts` verifies consumed ZIP resources' actual sizes and CRC32 through bounded streaming before decoding. Container/package/chapter XML limits are 256 KiB / 1 MiB / 4 MiB, with 32 MiB total chapter input/output. Invalid UTF-8, entities, internal subsets, unsupported/missing spine resources and excessive structure fail before engine insertion. Fixed-layout and encrypted/obfuscated books remain unsupported.

Both modes rebuild fresh XHTML rather than inserting original documents. Formatting preserves approved classes, IDs, inline/linked styles, text alignment, colors, spacing, tables and flex/grid layout. `book-styles.ts` parses CSS with css-tree 3.2.1, rebuilds approved declarations/media rules, and removes imports, fonts, active/unsupported properties/functions and unverified URLs. CSS is limited to 256 KiB per sheet, 2 MiB aggregate and 20,000 parsed nodes. Only declared local stylesheet/image resources resolve; archive traversal, remote/data/fragment/ambiguous resource paths are omitted. Original scripts, event handlers, embedded documents, forms and interactive links remain excluded.

`book-images.ts` validates PNG/JPEG/GIF/WebP headers and dimension budgets, or rebuilds standalone SVG through tag/attribute allowlists without scripts, foreign content or external resources. Images are limited to 128 resources, 8 MiB each, 32 MiB aggregate, 8192px per dimension and 32 megapixels. SVG adds 1 MiB input, 20,000 nodes and depth 64 limits. Unsupported images retain alternate text. Verified images receive owned Blob URLs; preparation failure/abort and session disposal revoke them. Embedded fonts, inline SVG/MathML, media, external resources, CSS positioning/animations and complete EPUB conformance are outside this increment.

Generated chapters carry restrictive CSP (`default-src 'none'`, sanitized inline styles, formatted images only through Blob URLs). The engine fallback denies network requests; iframe sandbox permits same-origin layout access without scripts or popups. Application fallback typography/theme uses zero-specificity rules so author styles win in formatted mode. Responsive bounds constrain oversized images, tables and long tokens. Text-only mode uses the application light/dark colors.

`epub-session.ts` owns the engine, isolated root, publication URLs and resize observer. Initial layout fits immediately; subsequent changes apply a trailing **150 ms** debounce, ignore zero/unchanged sizes and cancel on disposal. `scroll-layout.ts` isolates the epub.js 0.3.93 manager bridge: it updates the mounted view rather than clearing it, excludes the stable scrollbar gutter from chapter width, and retains visible text through a caret anchor where available. EPUB suppresses outer shell scrolling; the engine container owns vertical scrolling and horizontal scrolling is disabled at shell/container/chapter levels.

`useEpubReader` coordinates abort/generation ownership, source changes, mode reopening, navigation and errors. Mode changes snapshot chapter and generated text-node/offset (scroll ratio fallback); new sources reset the mode and reading point. Aborting during archive opening hides the old root, then releases it when opening settles; stale results never replace the new session. PDF storage/permissions/rendering remain independent. No EPUB bytes, CFI or EPUB identity are persisted here.

Unit/component fixtures cover sanitization, formatting/text modes, image ownership on cancellation/failure, mode/source lifecycle and debounce. Browser fixtures cover security, layout/resize and fixed controls, with fresh current-source browser evidence deferred to release #28 and parent #12. Owner merged the delivery; no new browser run is implied. The earlier `f1f76da` text-only run passed 107 Chromium cases; it does not validate later resize or formatted rendering. See [evidence](../evidence/epub-text-reader.md). Parent #12 and EPUB milestone 3 remain open for authored contents, typography controls, persisted identity/CFI, bookmarks and recent EPUB history.

## First increment: archive preflight — #122

`src/features/epub/archive-preflight.ts` inspects local Blob slices before any decompression. Fixed application policy limits archive size to 128 MiB, central directory to 4 MiB, entries to 4096, each declared expanded resource to 32 MiB, total declared expanded bytes to 256 MiB and expansion ratio to 200. These are product limits, not EPUB specification limits.

The service checks the end record, central directory and local-header agreement. It accepts stored/deflated entry metadata and signed/unsigned data descriptors; it rejects multidisk/ZIP64, encryption flags, unsupported methods, inconsistent offsets, overlap, duplicate paths, traversal/absolute/URL paths and ambiguous alternate filename fields. Names must be ASCII or explicitly UTF-8. Percent-encoded paths, query/fragment characters and archive prefixes/gaps are intentionally unsupported in this initial policy. The first stored resource must be the exact `application/epub+zip` mimetype, without local extra fields; a nonempty `META-INF/container.xml` resource must exist.

The bounded metadata check does **not** decompress resources, verify resource CRCs, parse container/package XML, certify EPUB conformance, block remote resources or authorize rendering. Declared sizes can lie: the future decompressor must independently enforce actual output limits and CRCs. The existing EPUB selection placeholder stays unchanged until a safe renderer is integrated. Cancellation is checked before/after reads and through directory traversal; document bytes/handles are never persisted by this service.

ZIP fields follow [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT). Container identity follows [W3C EPUB 3.3 OCF](https://www.w3.org/TR/epub-33/#sec-ocf). Reference implementation APIs: [epub.js README](https://github.com/futurepress/epub.js/blob/master/README.md). Dependencies are not added in the preflight increment.

## Remaining parent integration sequence

1. Add authored contents navigation and typography settings with explicit format/UI ownership.
2. Stabilize CFI across font/window changes; persist EPUB content identity, CFI and settings in independent versioned metadata services, with file revalidation.
3. Integrate EPUB bookmarks and recent history without saving document bytes.
4. Execute representative EPUB 2/3, security and supported-browser release acceptance in #28; record current screenshots and tested versions. Keep #12 and EPUB milestone 3 open until remaining acceptance is met.

The initial archive unit suite uses adversarial byte fixtures and bounded read/cancellation assertions. There is no browser or EPUB reading acceptance claim for this foundation-only increment.

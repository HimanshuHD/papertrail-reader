# EPUB implementation — #12

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

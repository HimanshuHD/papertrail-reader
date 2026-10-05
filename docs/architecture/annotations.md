# Annotation foundation (#140)

Parent [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) is delivered progressively. This increment defines storage and restoration contracts; it does not add highlight or note controls to the reader. PDF and EPUB renderer adapters follow in #141/#142, and the panel follows in #143.

## Identity and retention

Reuse `fingerprintDocument` from the explicitly selected file. `AnnotationIdentity` combines its `sha256-chunks-v1` digest with PDF/EPUB format. Renamed/moved identical bytes reuse annotations; changed bytes or a different format use a separate document record. No filename/path heuristic transfers annotations to a changed document.

`papertrail-annotations` is a separate IndexedDB database, using the shared transaction/connection service. Persist only whitelisted selectors, color, plain-text note, IDs and timestamps. Quotes/context are bounded excerpts of selected text; full document bytes, file handles and paths are not stored or uploaded. Storage is local to the browser profile/site origin, not cloud backup or cross-device sync.

Annotations survive library reselection and Forget library, which only clears workspace access. `clearDocument(handle)` explicitly deletes that document's annotations without modifying reading positions or bookmarks. Browser site-data clearing/eviction can remove this metadata. A cleared record receives a new generation when explicitly reopened; stale handles cannot edit or delete the new record.

## Format-specific selectors

PDF selectors contain page segments (one-based page), text selectors and rectangles in fractions of the unrotated crop page, with origin at its top left. Multiple segments cover cross-page selections. #141 must convert PDF.js viewport geometry through the actual crop-box/viewport transform before persistence. `projectPdfRectangle` rotates normalized geometry; the adapter scales it to the current viewport for zoom. These are text-layer highlights, not OCR or modifications to the PDF.

EPUB selectors contain zero-based chapter, captured rendering mode, optional bounded CFI and text selector. CFIs are optional local references into the validated publication, not an interchange guarantee. #142 must resolve them inside the current sanitized chapter, verify DOM ownership and map their range to the same text index. Different rendering modes use text fallback rather than trust an old CFI.

Text selectors use UTF-16 start/end offsets (end exclusive), exact text, and up to 64 characters of context on each side. The renderer adapters must provide deterministic canonical text with source-offset mappings: PDF uses its existing extracted/text-layer index; EPUB must use equivalent sanitized source text across reflow/views. The service never rewrites whitespace to make a failed quote match.

Restoration first checks format and full fingerprint, then validates the page/chapter, quote and context. It accepts the saved offsets when verified, otherwise a unique context-qualified quote match within that same page/chapter. Missing content, changed identity, invalid selector, mismatch, ambiguity or exceeded search budget returns `unresolved` with a reason. A multi-page PDF annotation resolves only when every segment does. Reanchored PDF text returns no old rectangles: the renderer must calculate new ones before painting. A CFI candidate is used only when its offsets equal the independently verified text range; errors fall back to that verified text.

## Storage contract and migrations

Call `open(identity)` on deliberate document selection; retain its identity/generation handle. Use `list`, `create`, `update`, `remove` and `clearDocument` with that handle. Do not call `open` to recover a failed mutation automatically. UI consumers must also discard results from a prior document selection; no reader/composable integration is delivered here.

The physical IndexedDB version is 1, with document metadata schema version 2. Supported v1 metadata contains identity and v1 highlights (ID, selector, color, createdAt); migration keeps those and adds empty notes, updatedAt and a new document generation. This is a tested compatibility schema, not a claim that a v1 highlighting UI previously shipped. Known schema migration commits atomically when opening the document. Unknown future versions, duplicate IDs and corrupt collections reject without choosing, dropping or overwriting entries. The service whitelists fields, excluding unknown payloads from successful writes.

Read-modify-write operations share one transaction, so concurrent edits do not lose each other's changes. Success is returned after the transaction commits. Migration/create/update/delete failures roll back; typed failures distinguish quota, blocked/unavailable storage, invalid/future data, stale documents, missing annotations and limits. Future UI must show the failure and keep the reader usable, without claiming an annotation was saved.

Limits: 1,000 annotations/document; 100 PDF segments and 1,000 rectangles/annotation; 10,000 rectangles/document; 10,000 characters/exact quote; 4,000 characters/note; 2,000,000 total metadata text characters/document; 8 Mi UTF-16 units/indexed page/chapter; 20,000 quote candidates per fallback search. Notes remain plain text and must be rendered with text bindings, not HTML.

## Validation boundary

Unit tests cover selectors/geometry, quote and CFI verification, changed files, ambiguous matches, metadata migration/preservation, CRUD/reload, concurrent edits, stale generations and transaction failures. Storage tests use a serialized commit/rollback-aware seam; they do not claim native IndexedDB or cross-browser acceptance. Native renderer/storage behavior is validated with #141/#142 and final #145/#28 acceptance. Full Browser E2E follows the existing reviewed release-branch-to-main gate, with no feature-branch bypass.

## PDF highlight integration (#141)

PDF highlighting now uses `usePdfHighlights` to open the fingerprint-scoped annotation record, coordinate CRUD and discard late results after document switches. It locks editing after persistence/refresh failures until explicit retry. The existing reader controls and utility panel modes remain available; a compact keyboard-accessible highlight bar supports selection, color, saved-highlight navigation and deletion. The shared notes panel remains #143.

`features/pdf/highlights.ts` maps complete selections across ready text layers to the existing PDF canonical text index. Partial selections spanning an unloaded/image-only page are rejected, rather than saving only visible fragments. Native range rectangles are clipped to the current crop page and unrotated before storage. On rendering, each saved page segment is quote/context-verified and measured in the current text DOM. This rebuilds geometry after zoom, intrinsic page rotation, resize and virtualization, and avoids reusing stale persisted rectangles. Unresolved rendered segments are marked in the saved-highlight selector. No document file is rewritten.

Verification instructions and the boundary between passing unit/component tests and pending release-native acceptance are in [PDF highlight verification](../testing/pdf-highlights-141.md).

### PDF highlight visual corrections — #149, #150, #151

PR #148 also joins nearby text fragments per line while preserving column gutters, composites each annotation once at a constant opacity, and uses pastel Yellow/Green/Blue/Pink. Active outlines do not darken the fill. Native selection uses translucent blue so canvas text remains visible. Regression checks cover overlapping fragments, line boundaries and column separation. Owner visual acceptance remains pending; verify wrapped paragraphs, selection legibility, active/inactive color consistency, zoom and rotated pages after deployment. Release Browser E2E remains tracked in #145/#28.

### Highlight text contrast and selection follow-up — #151 / #152

PR #148 now uses multiply blending within an isolated PDF page so pastel highlights and native selection preserve dark canvas glyphs. Line-break selection blocks are transparent. Pointer drags defer annotation geometry capture until release (including release outside the reader); keyboard selection remains available. Pointer cancellation, blur and document changes clear drag state. Component regression coverage checks that Save stays disabled during a drag and enables after release. Owner visual verification of contrast and drag smoothness remains pending under #145/#28.

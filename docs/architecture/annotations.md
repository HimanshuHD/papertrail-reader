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

### Native PDF selection guards (#152)

`features/pdf/text-selection.ts` supplies the PDF.js viewer selection guard omitted by low-level TextLayer rendering. One listener set per document coordinates mounted pages; empty guards cover blank selection areas during a drag and reset on release/cancel/blur. Glyphs sit above the guard and the whole text surface keeps a text cursor. Older engines receive the moving-boundary compatibility guard. PdfPageView disposes and reinstalls guards on text replacement and releases them on virtualization/unmount. Empty guard nodes do not change canonical quotes or offsets.

### #152 margin and outside-page drag revision

PR #153 now keeps an explicit mouse-drag text anchor. Margin starts resolve to a real text boundary on the nearest line; moving endpoints resolve against mounted pages in the same reader, including outside-page positions and re-entry. Backward/cross-page drags retain the original anchor. Pointer updates are coalesced per animation frame; release resolves the final coordinates before saving the selection. Cancel, blur and disposed text layers release drag state. Touch, modifier-assisted selection and native double/triple clicks keep their native behavior. Glyph geometry is measured from current ranges, including page rotation and Unicode boundaries. New coordinate regressions exercise margins, outside/re-entry, cross-page, pointer ownership, cancellation, native double-click handling and 90-degree rotation. Owner native verification is checked on merged PR #153; automated release acceptance remains #145/#28; prior workspace-unavailable notes are superseded by this implemented revision.

## EPUB highlight integration (#142)

PDF and EPUB share `useAnnotationHighlights` for fingerprint-scoped persistence, stale-result protection and explicit storage retry. EPUB captures only a single noncollapsed selection owned by the mounted sanitized chapter. Its deterministic UTF-16 text index joins inline runs, separates blocks and excludes image-alternative scaffolding. Source-node offsets rebuild ranges in the current document.

Capture stores a bounded CFI when EPUB.js can supply one; rendering always resolves quote/context against the current chapter text. It does not navigate or paint from an unverified CFI. Formatted and text-only views use the same canonical index. Missing or ambiguous matches stay Unresolved, and changed fingerprints open separate records. Selecting a saved entry navigates to its chapter; missing chapters remain Unresolved.

CSS Highlight API ranges paint pastel backgrounds without overriding authored foreground colors or wrapping chapter text. Ranges follow browser layout during typography/resize. Chapter/mode/document changes dispose styles, ranges, observers and selection listeners before rebinding. DOM replacement schedules range resolution again. Engines without this API keep CRUD available and show a capability notice; no invisible success is claimed. No book bytes, paths, or handles are added to annotation storage.

Unit/component coverage exercises inline selections, optional CFI capture, mode restoration, unsupported APIs, unresolved anchors and shared storage controls. The native lifecycle case is added to the release Browser E2E suite but is not executed on this feature branch. See [EPUB verification](../testing/epub-highlights-142.md).

## Shared annotation panel and notes (#143)

`AnnotationsPanel` is the same utility-panel component in PDF and EPUB. Renderer-specific parents provide annotation lists, known unresolved states, navigation and storage callbacks. The panel has no direct document/file/database access. It filters excerpts, notes, page/chapter labels and colors, and supports notes-only filtering. Existing reader quick actions remain available.

Notes attach to a saved highlight and use the existing schema-v2 `note` field, bounded at 4,000 UTF-16 units. No database migration is required. Text interpolation and textarea values render note content as text; no HTML conversion or content execution occurs. Delete note saves an empty note while retaining the selector/color; Delete highlight and note removes the whole annotation.

The shared coordinator commits notes through the same generation-scoped mutation protocol as highlights. Storage errors preserve the draft and lock editing until explicit retry. Same-document retry keeps last-known metadata while loading; fingerprint changes clear it immediately, and stale results cannot publish into the new document. Panel keys scope drafts to the fingerprint, and asynchronous selection changes cannot replace a newer draft. Closing the panel or changing the selected item discards unsaved edits; Save is explicit.

Selecting an annotation reuses verified PDF/EPUB highlight navigation and the 24px reading-pane inset. The editor receives focus after navigation settles, scrolling only its own utility panel. Closing returns focus to the Annotations opener. PDF's workspace schema now recognizes the Annotations utility mode and reports restored state when its reader is ready; previous modes remain valid. Known unresolved anchors stay visible/editable rather than being painted on unrelated text.

See [panel and notes app verification](../testing/annotation-panel-143.md). Native browser/IndexedDB acceptance remains #145/#28. Reading statistics remain #144.

## Annotation visual refinement — #156

Child of #143, included in PR #155. Selected option 1 replaces the persistent PDF/EPUB highlights row with a selection-anchored toolbar (four pastel color saves, highlight action and Add note). Native iframe coordinates are mapped into the outer viewport and clamped for narrow screens. Scroll/resize dismisses stale selection controls. Add note saves the owned highlight before opening its editor. The existing Annotations utility icon toggles a matching drawer: slim colored markers, serif excerpts, inline plain-text notes, per-entry menus and compact filters. Existing storage limits/retry and verified-range navigation remain unchanged. Owner visual verification and reviewed release acceptance #145/#28 remain pending.

## #156 option 2 composer and reader note indicators

PR #155 now expands Add note inside the selection toolbar, without a storage write or opening the drawer. Save highlight with note supplies the note to `AnnotationStorage.create`, committing one schema-v2 annotation in one transaction; transaction failures leave neither partial highlight nor orphan note. Add highlight remains independent. Saving it while editing retains the composer and switches to Save note. Cancel/back discard only the note draft and reverse the expansion; failed writes preserve drafts with an in-composer retry. Completion guards preserve newer selections.

The drawer replaces the associated entry's action-menu contents with its note editor. PDF indicators derive from freshly verified highlight rectangles and follow page rendering/zoom/virtualization; EPUB indicators derive from resolved ranges and iframe coordinates, refreshing on scroll and observed reader/frame/body resizing. Plain-text hover/focus previews lead to the selected drawer entry. No marker is painted for unresolved text or an annotation without a note. Native layout/visual verification remains pending under #145/#28.

The coordinator retains the committed creation ID even if refreshing the list fails. In-composer retry keeps the draft and updates that ID rather than creating another record. Document identity changes discard it. Inline Save note can atomically update the existing highlight's chosen color and note together.

## Annotation interaction follow-up (#157)

Only explicit Add highlight or Save highlight with note writes a pending selection. Swatches update the live native-selection preview and chosen color without storage mutations. Clicking a saved range uses its verified geometry and a small pointer movement threshold; actual drags remain selection gestures. It clears unrelated native selections and opens/reveals the owned annotation.

List excerpts show 100 Unicode characters followed by three dots when truncated; complete quotes remain in storage and filter/navigation logic. Global button styling excludes annotation/bookmark entry surfaces, preserving their own list treatment. Active and hover controls add a 2px inset bottom accent without changing other border geometry.

`FloatingPopover` portals per-entry actions to the overlay surface (or native fullscreen element), measures both trigger and content, clamps to viewport margins and flips above when space below is insufficient. Editor expansion changes width, not panel layout. Outside pointer, Escape, section scroll and successful actions dismiss; note focus uses preventScroll. Action order is Add/Edit note, Delete highlight and note, then color. Errors retain drafts. `ToastHost` announces successful committed/loaded mutations through a bounded three-message queue, auto-dismiss and accessible close controls; failed or stale operations never show a success toast.

PDF search input and results share their own directly opened right-panel mode. Contents, Bookmarks and Annotations likewise open directly from toolbar icons; no panel tab strip remains. EPUB continues its existing direct Contents/Bookmarks/Annotations modes; adding publication-wide EPUB text search is outside this annotation refinement.

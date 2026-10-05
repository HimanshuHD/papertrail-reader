# PDF highlight verification (#141)

This increment adds a compact PDF highlight bar below the existing controls. Select text, choose Yellow/Green/Blue/Pink, then use **Highlight selection**. Use the saved-highlights selector or click a painted highlight to activate it, change its color or delete it. All controls support keyboard focus; normal modified text-selection keys are preserved.

## Owner app checks after deployment

1. Select text across wrapped lines and two rendered adjacent pages. Save it and verify all selected text is highlighted, without highlighting unrelated text or gaps between pages.
2. Change the color, reload and reselect the identical file (including under a different filename). Verify highlights restore, while saved reading position, search and bookmarks still work.
3. Zoom in/out, fit width/page, resize, and scroll far enough to virtualize a highlighted page. Return and verify overlays align with the text. Include a PDF with intrinsic 90/180/270-degree page rotation and a nonzero crop box.
4. Switch between documents. Identical bytes reuse highlights; different bytes start with their own highlights. Old pending selections/async results must not appear on the new document.
5. Delete a highlight and verify it remains deleted after reload/reselection. Test color/delete via keyboard and select text using browser keyboard/caret selection where available.
6. Image-only PDFs have no selectable text: saving stays disabled and the bar explains the limitation. No OCR or source-PDF editing is included.
7. Block storage or simulate quota failure. The reader remains usable; the bar reports failure and requires Retry highlights before another edit. A successfully saved change followed by a failed refresh is reported distinctly to avoid duplicate retries.

## Automated evidence boundary

Unit/component tests exercise canonical text/geometry mapping, complete selection capture, intrinsic rotation, page overlay rerendering, UI actions, stale loads/mutations and persistence failure recovery. Release Browser E2E cases exercise real PDF.js and native IndexedDB, including reload, changed content and rotated pages. They are added now but run only at the reviewed release-branch-to-main gate (#145/#28); no feature-branch browser bypass is used. Screenshot/real-browser acceptance must be recorded against the release candidate before claiming those gates complete.

The full annotation/notes panel follows in #143. EPUB highlights follow in #142. Architecture/storage details are in [Annotation foundation](../architecture/annotations.md).

### PDF highlight visual corrections — #149, #150, #151

PR #148 also joins nearby text fragments per line while preserving column gutters, composites each annotation once at a constant opacity, and uses pastel Yellow/Green/Blue/Pink. Active outlines do not darken the fill. Native selection uses translucent blue so canvas text remains visible. Regression checks cover overlapping fragments, line boundaries and column separation. Owner visual acceptance remains pending; verify wrapped paragraphs, selection legibility, active/inactive color consistency, zoom and rotated pages after deployment. Release Browser E2E remains tracked in #145/#28.

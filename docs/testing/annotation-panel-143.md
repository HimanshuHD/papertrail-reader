# Annotation panel and notes verification (#143)

Parent #15; native release acceptance #145/#28. Notes are plain text attached to saved highlights, local to this browser profile and origin. They do not modify the source PDF/EPUB. Child #156 adopts selected design option 1 for PDF and EPUB. The persistent highlight row is replaced by a native-selection toolbar and the Annotations utility icon toggles the right drawer.

## Highlight with note workflow

1. Select text in a text-based PDF or EPUB. The contextual toolbar appears above the selection; choosing a pastel color saves the highlight immediately. The pen action saves with the current color.
2. To create a highlight and note together, choose Add note on the selection toolbar. The highlight must save successfully before the right drawer opens its note editor. A failed write leaves the selection available and shows recovery guidance.
3. Enter your plain-text note and choose Save note. Saving is explicit; notes are attached to that highlight and stored locally, without changing the source file.
4. Revisit the annotation through the top Annotations icon and its excerpt, or click a painted highlight in the reader. Excerpt navigation places the verified range near the reader top with a 24px inset.
5. Open the entry's menu to edit/add a note, change its color or delete the highlight and its note. The editor also supports Delete note, which retains the highlight. Save before switching entries or closing the panel.

## App checks

1. In PDF and EPUB, open Annotations with its icon button. Verify highlight count, page/chapter, excerpt, color and known Unresolved labels. Use keyboard Tab/Enter; close with Escape and verify focus returns to Annotations.
2. Select a list item. Verify current highlighted text appears 24px below the reading pane top, subject to document-edge clamping. Selecting the excerpt navigates; the per-item menu opens Add note/Edit note. Editor focus waits for navigation; only the panel scrolls to its editor.
3. Add a note with multiple lines and markup-like text, save, then reload/reselect the identical file. Verify exact plain text restores. Renamed identical bytes reuse metadata; changed bytes remain isolated.
4. Search excerpts, notes and page/chapter labels; combine color filtering and With notes only. Verify useful empty and no-match states. An active editor remains available even if its item is filtered out.
5. Edit a saved note, cancel an edit, delete only the note, recolor its highlight and delete the highlight with its note. Verify cancel restores the stored text and list focus; deleting a note keeps its highlight; removing a highlight returns focus to the filter.
6. Test the 4,000 UTF-16-character note limit and disabled controls during storage/reader work. Simulate blocked/quota/refresh failures: show a truthful notice, keep a failed draft, lock mutations until explicit retry. Same-document retry retains last-known metadata; switching documents clears its state and ignores late writes.
7. Verify existing Contents, Bookmarks and PDF search modes; PDF restores the saved Annotations panel mode. Check both themes and narrow/wide layouts. Unsaved drafts are not autosaved: save before switching items or closing the panel.

## Validation boundary

Unit/component tests cover safe text bindings, filters, unresolved labels, note bounds, note/delete/color callbacks, failed drafts, stale selection saves, dirty drafts during color refresh, PDF/EPUB integration, focus restoration and coordinator retry/document generations. Existing metadata tests cover persisted notes/migrations/transaction rollback.

PDF and EPUB Browser E2E lifecycle cases now include note persistence and panel controls. They are added and type-checked, not executed on the feature branch. Native IndexedDB/selection/layout, screenshots and accessibility acceptance remain #145/#28 through the reviewed release-to-main workflow; no bypass is used.

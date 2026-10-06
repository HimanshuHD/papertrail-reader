# Annotation panel and notes verification (#143)

Parent #15; native release acceptance #145/#28. Notes are plain text attached to saved highlights, local to this browser profile and origin. They do not modify the source PDF/EPUB. Child #156 adopts selected design option 1 for PDF and EPUB. The persistent highlight row is replaced by a native-selection toolbar and the Annotations utility icon toggles the right drawer. Option 2 supersedes the earlier auto-open-drawer Add note interaction.

## Highlight with note workflow — option 2 (#156)

1. Select real document text. The anchored toolbar shows pastel color previews (no automatic save), an Add highlight icon with hover/focus tooltip, and Add note.
2. Add note expands the composer below the controls with a reversible slide transition. It opens no drawer and performs no storage write. Choose a color, type the note and press **Save highlight with note** to persist one annotation containing both selection and note in a single transaction. Empty notes cannot be submitted.
3. Add highlight independently saves without a note. If used while the composer is open, the saved highlight remains and the editor's primary action becomes **Save note**. Color choices remain pending until Save note explicitly commits the color and note together.
4. Cancel or the back arrow discards only the note draft and collapses the composer. A saved highlight remains; an unsaved selection/color remains available for Add highlight. A failed save keeps its draft and exposes retry inside the composer.
5. Highlights with notes show a margin note-document indicator in PDF and EPUB. Hover/keyboard focus previews plain text; activation opens Annotations, selects and reveals the matching entry. Unresolved ranges and highlights without notes have no marker.
6. In the drawer, the entry's menu provides Add/Edit note. This replaces that menu's actions with its editor, back arrow, Save note, Cancel and Delete note. It never appends a form to the panel bottom. Back/Cancel restores the menu; Save closes the popup after a successful commit. Delete note retains the highlight; Delete highlight and note removes both.
7. Notes remain local plain-text metadata, bounded to 4,000 UTF-16 units. Source files are unchanged. Save before switching selections or closing a composer.

## App checks

1. In PDF and EPUB, open Annotations with its icon button. Verify highlight count, page/chapter, excerpt, color and known Unresolved labels. Use keyboard Tab/Enter; close with Escape and verify focus returns to Annotations.
2. Select a list item. Verify current highlighted text appears 24px below the reading pane top, subject to document-edge clamping. Selecting the excerpt navigates; the per-item menu opens Add note/Edit note. Editor focus waits for navigation; only the panel scrolls to its editor.
3. Add a note with multiple lines and markup-like text, save, then reload/reselect the identical file. Verify exact plain text restores. Renamed identical bytes reuse metadata; changed bytes remain isolated.
4. Search excerpts, notes and page/chapter labels; combine color filtering and With notes only. Verify useful empty and no-match states. Opening an editor or a reader note indicator reveals its entry and resets filters that would hide it.
5. Edit a saved note, cancel an edit, delete only the note, recolor its highlight and delete the highlight with its note. Verify cancel restores the stored text and list focus; deleting a note keeps its highlight; the action menu remains beside its associated excerpt.
6. Test the 4,000 UTF-16-character note limit and disabled controls during storage/reader work. Simulate blocked/quota/refresh failures: show a truthful notice, keep a failed draft, lock mutations until explicit retry. Same-document retry retains last-known metadata; switching documents clears its state and ignores late writes.
7. Verify existing Contents, Bookmarks and PDF search modes; PDF restores the saved Annotations panel mode. Check both themes and narrow/wide layouts. Unsaved drafts are not autosaved: save before switching items or closing the panel.

## Validation boundary

Unit/component tests cover safe text bindings, filters, unresolved labels, note bounds, note/delete/color callbacks, failed drafts, stale selection saves, dirty drafts during color refresh, PDF/EPUB integration, focus restoration and coordinator retry/document generations. Existing metadata tests cover persisted notes/migrations/transaction rollback.

PDF and EPUB Browser E2E lifecycle cases now include note persistence and panel controls. They are added and type-checked, not executed on the feature branch. Native IndexedDB/selection/layout, screenshots and accessibility acceptance remain #145/#28 through the reviewed release-to-main workflow; no bypass is used.

## Follow-up verification

Verify slide-down/reverse transitions and reduced-motion behavior; no automatic drawer opening on Add note; Save highlight with note vs Save note labels; Cancel retains an independent saved highlight; hover/focus tooltip; per-entry replacement editor; reader note indicators after scroll, resize, typography/view changes and PDF zoom/virtualization. Late saves must not clear a newer selection. Browser screenshots/interaction execution remain at the agreed reviewed release gate.

## Shared interaction theme follow-up

Verify hovered, pressed, selected/open and keyboard-focused icons/buttons across library, PDF/EPUB utilities, popovers, menus, typography, theme picker and landing CTA. Match the Annotations reference's inset accent outline; filled/light controls must use contrasting text/icons. Confirm disabled controls have no hover/selected treatment, highlight swatches retain their colors, rings do not shift layout, and reduced motion removes transitions. Native visual comparison remains pending at the agreed owner/release gate.

## #157 follow-up verification

1. In both formats, pick each color without saving: the selection preview changes and no saved record appears. Add highlight saves once; Add note then Save highlight with note saves both fields once. Check the toast, reload persistence and failed-save recovery.
2. Long quotes display the first 100 characters plus `...`; search text beyond that boundary still finds the record and navigation resolves the full anchor.
3. Open each utility from its toolbar icon. Only its panel heading/content appears, without a tab strip. PDF Search keeps input, pending/error status and results in one panel.
4. Open annotation actions near each viewport edge, then Add/Edit note. Confirm larger editor width, even padding, icons, shadows and action order; the list does not scroll or grow. Outside click and Escape close the popup; the next Escape closes the panel. Back/Cancel restores actions, successful saves/recolors close, failures retain the editor.
5. Click saved document highlights with a tiny pointer movement: matching annotation selects/reveals without stray native text selection. Drag across text remains normal selection. Margin note indicators preview plain text and open the same entry.
6. Verify narrow/wide layouts, both themes, native fullscreen, keyboard focus and reduced motion. Annotation/bookmark list items retain their list styling; controls show the 2px bottom accent without movement.

Native browser execution remains at #145/#28; local tests do not certify viewport appearance.

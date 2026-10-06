# EPUB highlight verification (#142)

Parent #15; acceptance #145/#28. Use an EPUB containing wrapped paragraphs, inline emphasis, images and multiple chapters.

1. Select text in formatted view, choose Yellow/Green/Blue/Pink and save. Check readable authored text and continuous selection across inline runs.
2. Choose a saved highlight, change color and delete it. Verify chapter navigation, count and persisted changes after reopening the same file.
3. Toggle Text-only view, resize, change typography and navigate away/back. Verify the same quote is highlighted without DOM wrapping, layout jumps or stale overlays.
4. Reload/reselect identical bytes, including a renamed copy. Verify restoration. Changed bytes must have a separate annotation record.
5. Verify invalid, missing or ambiguous anchors are labeled Unresolved rather than painted on different text. Select a removed chapter entry to verify explicit Unresolved state.
6. Check keyboard selection/controls, light/dark authored colors, storage failure notice and explicit retry. Browsers without CSS Highlight API must retain saved metadata and show a capability notice.

Local unit/component tests cover capture, canonical inline text, CFI failure fallback, formatted/text-only restoration, unresolved anchors, unsupported API and CRUD controls. The shared coordinator retains PDF persistence/race/error regressions. Native selection and IndexedDB acceptance are deferred to the reviewed release-to-main Browser E2E workflow under #145/#28; adding a test is not evidence of executing it. No browser workflow bypass is used.

The compact highlight controls are delivered here; shared notes/panel integration follows in #143. Annotation excerpts are local metadata, not modifications to the EPUB file. Browser site-data clearing can remove them.

## Saved highlight navigation — PR #154 review

Selecting a saved highlight in PDF or EPUB must align its first text line 24px below the reading pane's top edge, leaving the utility controls visible. EPUB navigates to the chapter and then resolves the exact quote in the mounted document. PDF first mounts the page, then resolves current text-layer geometry; an unloaded page waits for the renderer's resolution event. Repeated selection, chapter/page switches and document replacement must discard obsolete jumps. Test same-chapter/page and distant chapter/page targets, wrapped text, formatted/text-only EPUB, PDF zoom/rotation and document boundaries. Near the start/end, the scroll target is clamped to available document space. Unresolved text is not used as a scroll destination.

Owner confirms EPUB highlight creation works; saved-highlight navigation and top-offset corrections require fresh app verification. Unit/component coordinate regressions and GitHub CI are separate from deferred #145/#28 native Browser E2E acceptance.

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

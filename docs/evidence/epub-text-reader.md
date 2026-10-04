# Verified local EPUB text reader — #124

[PR #125](https://github.com/HimanshuHD/papertrail-reader/pull/125) adds a first local reflowable EPUB text reader with previous/next chapter buttons and a chapter selector. It builds on merged archive-preflight PR #123. Original images, author styling and external links are omitted, as explained in the reader. Fixed-layout and encrypted publications are rejected. EPUB CFI persistence, typography/reflow controls, authored contents, bookmarks and recent history remain parent #12 and milestone 3 scope.

## Validation

Application/test source `f1f76dae5457e676ec026e6ceeff22c1a5c95b29` passed [Frontend CI 37175969681](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37175969681): lint, formatting, types, 164 unit/component tests, 10 pipeline tests and production build. [Browser E2E 37176268989](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37176268989) passed **107 cases**, eight intentional viewport-specific skips, no failures or retries.

Unit fixtures cover stored/deflated resources, actual decompression limits, declared-size lies, CRC mismatch, hostile XHTML, EPUB 2 doctype compatibility, RTL direction, unsupported publications, cancellation, stale sources, pending archive opening/navigation and engine disposal. Consumed entries are verified before XML parsing; chapters are rebuilt into inert XHTML. The lazy engine receives only generated local paths and text, restrictive CSP and a script-free iframe sandbox. PDF storage, file permissions and EPUB engine ownership remain separate.

Browser fixtures exercise EPUB chapter navigation, light/dark appearance, hostile content with no external requests/script execution, malformed-book recovery and source replacement at 320/375/768/1024/1440px. Existing PDF reading, bookmarks, recent history, workspace restoration and independent scrolling regressions run in the same suite. This is Chromium fixture acceptance; supported-browser and owner preview acceptance remain separate gates.

## Inspected screenshots

Light/dark captures at 320px and 1440px were inspected. The Library opener has reserved heading space; title/caption and chapter controls remain readable without horizontal overflow. The complete report is [artifact 11293427377](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37176268989/artifacts/11293427377), retained through 11 October 2026.

![Light EPUB reader at 320px](../screenshots/epub-text-light-320.png)

![Dark EPUB reader at 320px](../screenshots/epub-text-dark-320.png)

![Light EPUB reader at 1440px](../screenshots/epub-text-light-1440.png)

![Dark EPUB reader at 1440px](../screenshots/epub-text-dark-1440.png)

An earlier browser run targeted the departing inert sidebar input during source replacement; the final test selects the interactive library picker. The existing short-height scroll test now waits for its recent item before establishing its geometry baseline. Screenshot inspection found and corrected opener/title overlap. The clean run above supersedes that initial result.

## Review gate

#124 remains open until owner review and merge. #12 and EPUB milestone 3 remain open for the remaining format acceptance. Preparation and Reading continuity milestones are closed. Final evidence/image changes are documentation only; the application/test source above remains unchanged.

---

[Previous](recent-library.md) · [Documentation home](../README.md) · [Evidence index](README.md)

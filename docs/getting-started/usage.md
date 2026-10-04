# Read with PaperTrail

Open [PaperTrail](https://himanshuhd.github.io/papertrail-reader/#/app), then use the library **+** button to select a folder or PDF/EPUB files. Folder access depends on browser capabilities; file selection remains the fallback. Documents stay on your device.

Choose a PDF in the library. The library, document and utility panel scroll independently. Use the toolbar for page navigation, zoom, fit, search, contents and fullscreen. Icon labels appear on hover/focus; keyboard help describes shortcuts. The original v1.0.0 release did not include reading continuity. Current main retains PDF reading positions, zoom/fit mode and the single library workspace. Browser file-input sources require reselection; retained folder handles resume automatically only with granted access. The current EPUB increment supports local reflowable books.

The utility panel provides PDF contents and search results. Bookmarks are available for PDFs: open Bookmarks, enter a name (or use the page default), and choose Save current place. Select a saved bookmark to return to its reading anchor, or use Rename/Remove. Bookmarks follow the same PDF after renaming; changed content stays separate. They are local metadata, without copied PDF bytes. Storage failures preserve the input draft and show recovery guidance. Forget library keeps reading metadata; clearing browser storage removes it. Selecting a result navigates to and highlights the selected occurrence. The library and utility panels can be toggled to give the document more space. Light/dark appearance is available from the header.

Password entry is not supported in v1.0.0. Consult the [release support and limitations](../releases/v1.0.0.md) before relying on unverified browser combinations. See [Roadmap 2](../roadmaps/roadmap-2.md) for planned features.

---

[Documentation home](../README.md) · [Next](local-setup.md)

## Search your library and return to recent PDFs

Use **Search documents...** to filter filenames, titles, paths and formats in the current listing. This does not search PDF page text; use the reader’s Search button for that. Clear the library query to restore the full tree.

The collapsible **Recent** section keeps the last 20 successfully opened PDFs on this browser. Choose an entry to reopen matching content in your accessible selected files. If access is missing or the file changed, use **+** to reselect its source and try again. Renaming the same content preserves its reading identity. Removing a recent entry or **Clear recent history** leaves reading positions and bookmarks intact. **Forget library** clears workspace access but preserves recent history and reading metadata. Clearing site storage clears saved metadata. EPUB reading history remains a later #12 increment.

## EPUB reading — current increment

After selecting an accessible EPUB, PaperTrail opens supported reflowable chapters with local book formatting and illustrations. Use **Contents** in the top utility bar to open the right-side chapter/section panel, or use the fixed previous/next icons at the sides of the reader. Contents uses the book’s nested navigation, with chapter order as a fallback; there is no separate Chapters dropdown. **Text-only view** starts off; switch it on for simplified text without book styling/images. Switching modes retains your chapter and reading point where possible. Resize reflows after a 150 ms pause.

Formatted mode supports common text styling, spacing, responsive images, tables and flex/grid layouts. Scripts, remote resources, embedded fonts, interactive links, media and fixed-layout/encrypted books are unsupported. Book colors remain authored in formatted view; text-only view follows Light/Dark mode. Invalid books show a recovery message and Retry action. Saved EPUB identity/CFI, bookmarks and recent history follow later. No EPUB bytes are stored by the application.

## EPUB contents and typography — #131

Open **Contents** to browse the book's nested table of contents and select a chapter or section. If the book has no usable contents, chapter order is shown. The highlighted entry follows your selected destination/current chapter; precise reading-location tracking follows in #132. Fixed side icons provide previous/next navigation.

Open **Typography** to choose font size (14–32 px), line spacing (1.4/1.8/2) or responsive Narrow/Medium/Wide reading measures. **Book default** preserves book text styling; **Full width** uses the available reading area. Explicit typography choices change text sizing and spacing while keeping book colors and illustrations. **Reset typography** restores the defaults. Controls work in formatted and Text-only view; settings remain through mode/chapter changes and reset when another book opens. They are session settings and are not saved after reload yet.

### EPUB utility bar and reading settings

The utility bar shares the PDF reader’s icon buttons and hover/focus labels. **Contents** toggles a right-side panel that docks when the reading area is wide enough and overlays narrower readers. Close it with the close button, the Contents toggle or Escape; focus returns to the toggle. Panel resizing retains the reading point where feasible through the existing reflow handling.

**Typography** opens a compact popover. Use −/+ to step through 14–32 px sizes (Book default shows the measured chapter size in brackets; the same size is not repeated as a numerical step); choose Compact, Comfortable or Spacious line spacing and Narrow, Medium or Wide reading width. Book default and Full width restore those individual defaults; **Reset typography** restores all book defaults. Escape or the close button dismisses the popover and returns focus; clicking outside also dismisses it. Changes apply to both modes for the current session and reset when another book opens. The same right-side utility area will host later Bookmarks and other features when implemented; no unavailable tabs are shown.

On mobile windows, reading-width controls are hidden and the book uses the available space. Tablet windows offer Full width, Narrow and Medium; desktop windows also offer Wide. Narrow/Medium/Wide use 50%/70%/90% of the available reader width, capped at 480/768/1100 px respectively; Wide leaves a gutter and differs from Full width. Shrinking the window resets unavailable widths to Full width on mobile or Medium on tablets. Clicking inside the document also dismisses Typography. Chapter changes show a centered loader if preparation takes more than 150ms; Contents stays visible during loading.

## #135 accepted delivery and next increment

Owner verified #131 and its seven review fixes, then merged #135 as `e9d59f4`. Accepted source `4be9aa0` passed Frontend CI 37217580155 (189 unit/component and 10 pipeline tests, lint/format/types/build). The controls described here are delivered; #132 is now active for stable session text/CFI restoration, followed by #133 persistence. Full current-source browser evidence remains deferred to #134/#28 release readiness.

## Keeping your EPUB reading point

Typography, window/library width changes and the Text-only switch retain the visible text and its position within the reading area where the rebuilt content permits. At a chapter's end the reader stays at the bottom. A switch that omits an image retains its source location at alternate text. This is session behavior; saved EPUB positions, bookmarks and recent EPUB history are planned in #133.

## #136 merge reconciliation and active #133

Owner merged #136 as `09610e6` after source `2f99f6b` passed Frontend CI 37223881477 (197 unit/component and 10 pipeline tests, lint/format/types/build). #132 is complete and its active label is removed. #133 now owns saved EPUB progress across reload, document switching and later reselection, plus identity/settings/bookmarks/recent history. Its fresh branch starts from updated main; #134 remains new for final release evidence. EPUB milestone 3 remains open: three open (#12/#133/#134), seven completed. Browser E2E remains deferred to reviewed release-to-main readiness.

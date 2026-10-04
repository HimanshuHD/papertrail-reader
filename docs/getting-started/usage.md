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

After selecting an accessible EPUB, PaperTrail opens supported reflowable chapters with local book formatting and illustrations. Choose a chapter from **Chapters**, or use the fixed previous/next icons at the sides of the reader. **Text-only view** starts unchecked; check it for simplified text without book styling/images. Switching modes retains your chapter and reading point where possible. Resize reflows after a 150 ms pause.

Formatted mode supports common text styling, spacing, responsive images, tables and flex/grid layouts. Scripts, remote resources, embedded fonts, interactive links, media and fixed-layout/encrypted books are unsupported. Book colors remain authored in formatted view; text-only view follows Light/Dark mode. Invalid books show a recovery message and Retry action. Saved EPUB identity/CFI, typography controls, bookmarks and recent history follow later. No EPUB bytes are stored by the application.

## EPUB contents and typography — #131

Open **Contents** to browse the book's nested table of contents and select a chapter or section. If the book has no usable contents, chapter order is shown. The highlighted entry follows your selected destination/current chapter; precise reading-location tracking follows in #132. The Chapters dropdown and side icons remain available.

Open **Typography** to choose font size (14–32 px), line spacing (1.2–2.2) or reading width (480/640/800 px, limited by available space). **Book default** preserves book text styling; **Full width** uses the available reading area. Explicit typography choices change text sizing and spacing while keeping book colors and illustrations. **Reset typography** restores the defaults. Controls work in formatted and Text-only view; settings remain through mode/chapter changes and reset when another book opens. They are session settings and are not saved after reload yet.

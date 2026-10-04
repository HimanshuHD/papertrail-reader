# Read with PaperTrail

Open [PaperTrail](https://himanshuhd.github.io/papertrail-reader/#/app), then use the library **+** button to select a folder or PDF files. Folder access depends on browser capabilities; file selection remains the fallback. Documents stay on your device.

Choose a PDF in the library. The library, document and utility panel scroll independently. Use the toolbar for page navigation, zoom, fit, search, contents and fullscreen. Icon labels appear on hover/focus; keyboard help describes shortcuts. The original v1.0.0 release did not include reading continuity. Current main retains PDF reading positions, zoom/fit mode and the single library workspace. Browser file-input sources require reselection; retained folder handles resume automatically only with granted access. EPUB remains planned.

The utility panel provides PDF contents and search results. The #115 preview also adds Bookmarks: open Bookmarks, enter a name (or use the page default), and choose Save current place. Select a saved bookmark to return to its reading anchor, or use Rename/Remove. Bookmarks follow the same PDF after renaming; changed content stays separate. They are local metadata, without copied PDF bytes. Storage failures preserve the input draft and show recovery guidance. Forget library keeps reading metadata; clearing browser storage removes it. Selecting a result navigates to and highlights the selected occurrence. The library and utility panels can be toggled to give the document more space. Light/dark appearance is available from the header.

Password entry is not supported in v1.0.0. Consult the [release support and limitations](../releases/v1.0.0.md) before relying on unverified browser combinations. See [Roadmap 2](../roadmaps/roadmap-2.md) for planned features.

---

[Documentation home](../README.md) · [Next](local-setup.md)

## Search your library and return to recent PDFs

Use **Search documents...** to filter filenames, titles, paths and formats in the current listing. This does not search PDF page text; use the reader’s Search button for that. Clear the library query to restore the full tree.

The collapsible **Recent** section keeps the last 20 successfully opened PDFs on this browser. Choose an entry to reopen matching content in your accessible selected files. If access is missing or the file changed, use **+** to reselect its source and try again. Renaming the same content preserves its reading identity. Removing a recent entry or **Clear recent history** leaves reading positions and bookmarks intact. **Forget library** clears workspace access but preserves recent history and reading metadata. Clearing site storage clears saved metadata. EPUB reading history follows the upcoming EPUB reader.

## EPUB text reading — initial increment

After selecting an accessible EPUB, PaperTrail opens supported reflowable chapter text. Use Previous chapter, Next chapter or the Chapter selector to move through the book; appearance follows Light/Dark mode. The first reader omits book images, author styling and interactive/external links. Fixed-layout and encrypted/obfuscated books are unsupported. Invalid books display a recovery message and Retry action; you can choose another document. Saved EPUB CFI, typography, bookmarks and recent history follow in later increments. No EPUB bytes are stored by the application.

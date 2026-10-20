# Reader shell and home entry (#42/#49)

## Compact workspace (#225)

The current reader keeps branding and theme controls inside the open library header. Closing the library moves the compact branding/theme group and the distinct book-stack reopen button into a normal-flow row above the reader. It does not remount the PDF/EPUB workspace or clear its reading state. The existing separator, width limits, saved width and responsive overlay/grid behavior are unchanged. The tab strip shares this same normal-flow row; it does not add another application header.

The library header measures whether its title and three 40px action targets fit. When they do not, Add and Refresh move into a vertical library-action menu, alongside Forget when a workspace exists. The existing file/directory picker paths are reused; menu navigation skips disabled actions and preserves focus on responsive changes. Close remains separate at the right edge.

ReaderView owns the reader-route deployment footer inside the sidebar; App retains it for other routes. The footer hides with the sidebar. The explicit deployment-information landmark remains available while visible; the centered environment/version and adjacent info button expose source-ref/SHA details in a non-modal FloatingPopover. The shared overlay target and fixed viewport placement prevent sidebar-scroll clipping, including native reader fullscreen. Click/tap (or keyboard activation) toggles the compact popover; hover/focus alone does not open it. Keyboard links/Escape/outside dismissal preserve focus. Ref links use actual branch/tag metadata; detached or invalid refs are never presented as branch hyperlinks. Existing Contents toggles/close behavior and document-level resources are unchanged.

Source references and acceptance are recorded in [#224](https://github.com/HimanshuHD/papertrail-reader/issues/224) and [#225](https://github.com/HimanshuHD/papertrail-reader/issues/225). Owner corrections take precedence over illustrative pixel widths in the images.

## Historical foundation design (#42/#49)

The following describes the initial layout demonstration, not the current local PDF/EPUB implementation.

Home remains at / with its existing foundation content and appearance control; Go to app is the final action inside its main card. /app opens the layout demonstration. Both use hash routing and Vite BASE_URL, so production and /preview/pr-N/ need no server rewrites. App header links back home. Deployment footer remains shared in App.vue.

## Component ownership

| Component       | Owns                                                | Input / output                                          |
| --------------- | --------------------------------------------------- | ------------------------------------------------------- |
| HomeView        | Foundation page and Go to app                       | RouterLink to /app                                      |
| ReaderView      | Sample metadata, selected ID and sidebar visibility | Handles LibrarySidebar select; passes selected document |
| ReaderShell     | Responsive sidebar/workspace grid                   | sidebarOpen plus sidebar/toolbar/default slots          |
| LibrarySidebar  | Grouped demonstration titles                        | documents/selectedId props; select(id) event            |
| ReaderToolbar   | Selected title and unavailable format controls      | document prop; no reader commands yet                   |
| ReaderWorkspace | Illustrative reading surface                        | document prop; no file parsing or renderer              |

At 1024px and above the library is a 280px column beside a flexible minmax(0,1fr) workspace. Below that threshold it stacks above the workspace; Hide library removes it at any width, and selection survives collapse. Header and toolbar wrap. Document titles wrap; no fake continuous filesystem watching or hierarchical discovery is implemented.

The view owns transient demo selection/collapse because these are local presentation state. Theme stays in Pinia. Real discovery/providers belong to #8/#9, PDF/EPUB engines to #10/#12. Each title/page is labeled as a sample; folder, contents and zoom/font actions are disabled. There is no file input or upload.

Native links/buttons, landmark names, pressed selection state and expanded sidebar state are provided here. Complete keyboard/focus restoration, live status states and accessibility validation remain #43; reusable browser E2E infrastructure remains #37.

## Review checks

Check home and direct #/app entry; Go to app/home/history navigation; widths 320/375/768/1024/1440; both themes; show/hide library; PDF/EPUB sample title changes; disabled unavailable actions and no horizontal overflow. Verify production/preview hash URLs independently. Component tests cover route entry/history, selecting and retaining metadata, collapsing/restoring library and honest unavailable actions.

## CI browser evidence

See [browser-testing.md](../development/browser-testing.md). PR #50 adds real Chromium checks (WebKit opt-in) against the built preview base path and home/app screenshots at representative widths. CI results and visual review must be recorded separately; a successful screenshot capture is not a pixel-comparison approval.

## Policy update (#52)

PR #50 browser screenshots/results are historical validation evidence. Automatic Frontend CI no longer installs/runs browsers; the retained suite is explicit-run tooling. See browser-testing.md for current commands and remaining coverage.

---

[Previous](vue.md) · [Documentation home](../README.md) · [Next](deployment.md)

## Shared button interaction theme (#156)

App buttons, icon controls, actionable links and menu summaries share the reference Annotations control's tinted inset surface and accent outline. Global interaction tokens adapt to light/dark/system themes; filled accent actions use an explicit contrasting foreground and hover/pressed shades. Annotation/bookmark listing surfaces keep their own styling. Framed popover/theme controls own their normal outlines and interactive 2px bottom accents; note markers use only a left hover accent, and Save actions retain stable borders, disabled controls do not receive interactive styling, and keyboard focus retains its outline. Component shapes and color swatches retain their identities. Add new filled actions with `pt-button-filled`; button-like links also use `pt-button`.

## Document session ownership (#220)

`DocumentSessionWorkspace` keeps a keyed PDF/EPUB component for each open document until it has been inactive for five minutes. Only the selected reader is visible and interactive. `DocumentSessions` owns session IDs and lifecycle (`loading`, `ready`, `suspended`, `reconnect`, `error`, `closed`), independent of library IDs and content fingerprints. Serializable records contain only metadata and reading/UI snapshots; local `File` access stays in a separate source map and runtimes are attached by session ID and generation. The compact tab strip exposes these in-memory sessions; persisted tab lists remain #222.

| State                                                                                       | Owner and suspension behavior                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PDF page, viewport anchor, fit mode, zoom                                                   | Session snapshot; restore ahead of saved document state after re-opening the adapter             |
| EPUB chapter/character location, text-only mode, typography                                 | Retained rendition while warm; snapshot restores location and typography after expiry            |
| PDF search query and utility panel                                                          | Retained query/results while warm; snapshot regenerates results/outline after expiry             |
| EPUB utility panel                                                                          | Session snapshot; no EPUB search feature is introduced                                           |
| Pending text selection, selection toolbar, highlight hover, page edit, popovers, fullscreen | Pending selection/popovers are dismissed on suspension; rendered DOM stays while warm            |
| Bookmarks, highlights, notes, saved positions and statistics                                | Existing fingerprint/document-keyed stores; session identity does not replace document ownership |
| Theme, library access, sidebar visibility/width                                             | Existing workspace settings                                                                      |

Switching captures the outgoing state while retaining its exact canvas/rendition and DOM. Inactive panels retain layout geometry but are hidden, inert and excluded from the accessibility tree; keyboard shortcuts, reading statistics and active-document events are restricted to the selected reader. Selection/popovers are dismissed on suspension. An inactivity timer starts on each departure and is cancelled on return. At five minutes, that reader is removed and disposed independently; its tab, local File access and serializable reading/UI snapshot remain. Reactivation then reconstructs the adapter behind a centered restoration loader. Ready retained readers switch without a loader; a reader still completing its first load can still show its opening state.

Close, disconnect, library clear and route teardown evict affected readers and cancel their expiry timers immediately. Generation checks reject callbacks and attachments from evicted readers. Disposal errors are isolated per instance and cannot poison future activation, clearing or new file opening; unrelated readers never wait on old disposal. Existing adapter cleanup releases canvases, workers, object URLs, iframe listeners, timers and observers. Retaining readers deliberately uses more memory than the former single-viewer policy; the five-minute limit applies per inactive tab, with no additional count-based eviction.

Reader instances namespace page, title, utility, bookmark and annotation IDs with their session ID, keeping labels and focus references local when multiple readers are retained. Page lookup and anchor capture use scoped page data attributes rather than document-wide IDs.

Library/recent activation and the accessible tab strip use this controller. Source replacement/forget clears sessions. Bounded local full-content hashing verifies identity before opening. Re-selecting the same verified content/format activates its existing session even through another name/File object; distinct content with identical names remains separate. A WeakMap caches hashes only while their File objects remain reachable. `close` retains a closed metadata record but drops its source; `disconnect` drops access and marks reconnect without serializing file bytes. Full permission reconnection and session restoration across reload remain #222.

## Accessible document tabs (#221)

`DocumentTabs` owns presentation and focus, while `DocumentSessionWorkspace` remains the only runtime owner. Library clicks always issue an explicit activation request, so reselecting the last library item works after switching or closing tabs. Active-session events keep the library selection and existing single-document continuity metadata aligned; session IDs do not replace document storage keys.

Arrow keys and Home/End move a single roving tab stop without activating; Enter/Space activates. Delete closes the focused tab, and a separately labelled native close button is visually inset inside the tab container. Enter/Space activates that close button without activating the document. Closing an inactive tab leaves the live viewer untouched. Closing the active tab selects right then left; final close focuses the library opener or library actions and shows the empty reader without deleting library/saved data. Active and hidden inactive panel IDs maintain tab/tabpanel relationships with only the selected reader exposed. Full labels and a single accessible custom tooltip retain long names; native title attributes are omitted to avoid duplicate popovers.

A horizontally scrollable strip keeps touch access at small widths. The separate vertical ellipsis appears only when tabs overflow and lists every open document with its current/error/reconnect state and selected marker, supports arrow/Home/End/Escape navigation and returns focus predictably. Tab keys do not reach the reader's window shortcuts. There is no tab-strip plus; the existing library source menu owns local file/folder selection. Overflow measurement includes the space reclaimed when its button disappears, avoiding a resize feedback loop. Existing source replacement/forget semantics remain; cross-source/reload restoration is not added here.

Functional component/browser tests cover tab focus, content identity, close order, empty/add behavior, independent PDF/EPUB state, light/dark, reduced motion and narrow menu bounds. No automatic visual comparison/capture workflow or approved baseline changes are introduced. Full persisted tab/reconnect acceptance remains #222/#223.

### Tab presentation and warm identity reuse

Tabs opt out of the shared button inset/selected treatment. Their own light outline, 3px spacing, small top radius and shadow-free hover state follow the approved reference. The active tab has no bottom border and joins the reader toolbar; inactive tabs keep a small bottom gutter. The smaller close icon is visually inside the tab container but is a native button beside the tab activator, avoiding nested interactive elements. Delete on the focused tab and Enter/Space on its close button both close the document.

Reusable PDF/EPUB/DOC/generic SVG badges live in `src/assets/icons`, consumed by `FileTypeIcon`; each occupies 30 × 20 CSS pixels regardless of extension length. This increment uses them in tabs only. DOC/generic icons do not introduce additional reader formats.

Completed content fingerprints are shared by the identity service in a WeakMap keyed by the immutable File snapshot. The tab host and reconstructed PDF/EPUB continuity use the same cached result; a new/reselected File is hashed again, and aborted/failed operations never populate the cache. The fingerprint cache does not retain document bytes; reader instances follow the separate five-minute lifecycle described above. Ready retained sessions switch immediately with no loader. After five inactive minutes, the adapter is released and returning sessions show a centered restoration loader until their saved reading position is ready.

### Compact workspace controls

The branding/tab row is 46px, with the logo and tab overflow control retaining their original 44px targets. The library title row and PDF/EPUB title/control row are 56px. Shared icon buttons use 40px targets; title text is reduced by 2px, and the PDF page and zoom fields are 28px tall with 13px text. Reader control rows scroll horizontally at narrow widths to preserve the fixed header height and keep all actions reachable.

The smaller theme control animates a sliding selection marker, preserving its pressed state and stored preference. Reduced-motion users get an immediate transition. Library Close keeps its expansion semantics but opts out of the always-selected button surface, retaining hover/focus treatment.

PDF zoom is displayed as an editable percentage between Zoom out/in, rather than in the title subtitle. Committed values are clamped to 25–400%; empty/non-finite edits restore the current value. Both direct entry and step buttons use the same anchor-preserving custom-zoom path and existing document/session persistence.

The PDF utility row has separated page-navigation, zoom, page-layout (Fit width, Fit page, Two-page view), and remaining utility groups. Page-navigation input/button gaps match the zoom group. Zoom uses a right-aligned numeric input with an adjacent percent adornment. Input focus outlines fit within the 40px row. The theme toggle retains a visible rounded track and circular animated selection marker; tab-hover close strokes increase to 3px.

### Accessible tooltips and two-page reading

`AccessibleTooltip` provides one shared tooltip implementation for document tabs and icon buttons. It portals to the active overlay target so horizontally scrolling toolbars cannot clip it, positions against the triggering element, clamps to the viewport, and repositions on scrolling/resizing. Hover or keyboard focus opens it; blur, leaving the trigger, activation, Escape, or another tooltip dismisses it. The highlight selection toolbar also uses this overlay target so the tab header cannot intercept its actions, and it unmounts while its reader is inactive. The trigger references the tooltip with `aria-describedby`, and each close button has a document-specific accessible name.

PDF two-page mode lays out existing page views in pairs, preserves the reading anchor when toggled, calculates fit width per page, and advances navigation by two pages. Its optional setting is saved with PDF reading state and restored after closing/reopening; missing or false settings preserve the single-page default. It remains compatible with retained readers and five-minute expiry. EPUB uses a single scrolling reader for long chapters. Two-page layout is PDF-only; legacy EPUB two-page settings are ignored without discarding reading position or bookmarks. SVG cover wrappers containing one local image are flattened to verified image resources; the original SVG tree is never rendered.

On cold opening, EPUB resolves the saved anchor in the initial chapter document before a paginated resize can remove its iframe. Initial resizing finishes before the reader reports ready, and the intended logical point is retained through overlapping layout changes. Later sidebar/utility-panel resizing supplies that anchor when recreating the view. Default scrolling, annotations, bookmarks, retained-reader expiry and existing unsupported-format boundaries remain.

### Session restoration foundation (#222, in development)

`session-snapshot.ts` defines a versioned tab list with at most 128 entries. Each entry contains a bounded document identity/listing, fingerprint and allowlisted PDF/EPUB reading/utility state. Files, reader engines, URLs, credentials and unknown fields are excluded. PDF two-page settings remain valid; EPUB pagination settings are discarded. Invalid lists fail as a whole rather than silently truncating or reordering tabs. The legacy single-active-document snapshot can produce one reconnect shell; its separate reading databases and library/sidebar context remain intact.

The controller can capture warm readers, restore ordered shells without mounting viewers, and rebind a supplied document only when its verified fingerprint and format match. Rebinding a closed tab is rejected. Explicitly reselecting a verified renamed document preserves its saved state. The UI still uses the existing single-document workspace continuity: applying these tab snapshots to startup, source reselection, refresh/replacement, lifecycle capture and accessible reconnect actions remains the next part of #222. This foundation does not claim that tab-list restoration is released.

Workspace storage checks both top-level and tab schema versions on load and again within the read/write transaction before saving. Newer data is preserved; only explicit Forget clears it. Same-version writes use the last successful transaction across browser windows, with no synchronization guarantee. The continuity queue skips obsolete source generations, preserves the final save on unmount and explains storage/newer-schema failures while reading remains available. Environment database naming is unchanged.

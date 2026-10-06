# Reader shell and home entry (#42/#49)

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

App buttons, icon controls, actionable links, menu summaries and semantic selected/open states share the reference Annotations control's tinted inset surface and accent outline. Global interaction tokens adapt to light/dark/system themes; filled accent actions use an explicit contrasting foreground and hover/pressed shades. Inset rings avoid layout shifts, disabled controls do not receive interactive styling, and keyboard focus retains its outline. Component shapes and color swatches retain their identities. Add new filled actions with `pt-button-filled`; button-like links also use `pt-button`.

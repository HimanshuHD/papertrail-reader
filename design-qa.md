# Sidebar feedback design QA — #14

## Comparison target and evidence

Source visual truth: [Recent reference](docs/screenshots/sidebar-reference-recent.png), 605 × 58 pixels, and [search reference](docs/screenshots/sidebar-reference-search.png), 390 × 125 pixels. The supplied images are partial UI crops with unknown CSS density. Scope is the owner’s three requested sidebar changes within PaperTrail’s existing design system, not recreation of the Add menu, app-wide colors or the entire mockup.

Browser-rendered implementation: [1440px dark](docs/screenshots/recent-library-dark-1440.png), [1440px light](docs/screenshots/recent-library-1440.png), [320px light](docs/screenshots/recent-library-320.png), [320px dark](docs/screenshots/recent-library-dark-320.png). Viewports are 1440 × 900 and 320 × 900 CSS pixels, device scale factor 1. States: selected PDF, expanded Recent containing one item, cleared library query; light Recent retains keyboard focus. Source sample count five differs from the fixture count one intentionally; the count represents actual history length.

[Combined comparison](docs/screenshots/sidebar-feedback-comparison.png) places the supplied crops beside the actual dark sidebar. Recent reference is proportionally normalized to 390px; search reference is native size; actual sidebar remains native 308px. This is a scoped structural/content comparison, not a claim of pixel-exact typography from crops with unknown density. Full-view captures assess pane layout and viewport bounds; focused sidebar comparison assesses the requested surfaces.

## Findings and required fidelity surfaces

No actionable P0/P1/P2 differences within the requested scope.

- Fonts/typography: existing readable PaperTrail sans-serif hierarchy retained. Recent label and muted count fit without truncation; placeholder is readable in both themes. Mock font sizing outside these requested controls is not being adopted globally.
- Spacing/layout: search immediately follows Library header, before workspace actions and scrollable lists. Leading search icon has sufficient input inset. Recent clock leads the row; count aligns at its trailing edge. Sidebar controls fit narrow and desktop layouts. Native focus ring is intentional.
- Colors/tokens: existing light/dark semantic panel, canvas, muted and brand tokens retained. Dark reference and implemented dark controls have the same functional foreground/background hierarchy; full palette redesign is outside this feedback.
- Asset fidelity: search reuses the existing icon system; clock uses upstream Lucide circle/path under the existing license. Vector assets remain sharp. No raster illustration is requested by the supplied crops.
- Copy: placeholder is exactly `Search documents...`; row is `Recent`. Visible search label/help and empty-history sentence are absent. Input retains `Search library` accessible naming and screen-reader-only result count. Actual file-access error guidance remains available.

## Browser validation and comparison history

Accepted application/test source `ead6e5e9f453085f939c2abf5e2072dbc92ded86` passed Frontend CI 37149532676 and Browser E2E 37149606676: 122 unit/component, 10 pipeline and 102 browser cases, eight intentional skips, no failures/retries. All five widths verify pointer collapse, keyboard Enter expansion, search placement, exact placeholder, removed copy, history recovery and clearing without deleting reading metadata. The recent-library lifecycle records console/page errors and asserts none. Existing PDF geometry/bookmark/workspace tests remain green.

First combined comparison found no P0/P1/P2 issue, so no visual fix iteration was needed. Browser images above and the combined comparison are the final evidence. Local cloud preview was attempted at terminal.local:4173 but blocked by the client; local interactive-preview verification remains unavailable. This report's visual and interaction acceptance uses the repository's GitHub Chromium fixtures, not a claimed local cloud-browser handoff, OS-picker or deployed-preview certification.

## Implementation checklist

- [x] Reconcile and close accepted PDF #13; EPUB/CFI belongs to #12 in milestone 3.
- [x] Separate collapsible Recent component with leading clock/trailing count.
- [x] Header-adjacent accessible search with exact placeholder.
- [x] Remove redundant visible copy and retain recovery feedback.
- [x] Inspect combined source/implementation comparison and light/dark responsive captures.
- [ ] Owner review/merge of #121; then reconcile #14/milestone 2.

Follow-up polish: none required for the scoped feedback.

final result: passed

## Annotation option 1 — #156

Visual target: selected generated option 1, contextual selection toolbar and right Annotations drawer. Implementation uses the existing semantic light/dark tokens and licensed icon system; no raster assets are needed for these UI controls. Selection toolbar, top toggle, colored markers, readable serif excerpts, inline notes and overflow actions are implemented for PDF and EPUB.

final result: blocked

Browser capture and same-viewport visual comparison are deferred to the owner preview and #145/#28 reviewed release gate, following the owner's instruction to run Browser E2E at release. Unit/type/build checks are not visual certification. Verify both themes, toolbar placement, both document formats, narrow screens, selection legibility and drawer transitions before visual acceptance.

### Design standard for future features

Design the primary workflow before implementation. Reuse the reader utility bar, drawer, spacing, semantic colors, typography and icon system. Show visual options for substantial new interfaces, implement the selected reference, and cover loading, error, empty, hover, focus and responsive states. Compare rendered screenshots with the selected design at the agreed browser gate.

## #156 selected option 2 follow-up

Target: the second displayed generated concept, expandable toolbar composer, refined by owner requirements. The toolbar keeps highlight controls above a slide-down editor; combined save is explicit, back/cancel reverses the expansion, and the drawer editor replaces its own entry menu. Added margin note indicators use the existing speech-bubble icon and semantic tokens. Same-viewport capture, transition/placement inspection and native overflow certification remain deferred to the agreed owner/release gate. Final result for this revision: blocked pending browser comparison; local checks do not certify visual fidelity.

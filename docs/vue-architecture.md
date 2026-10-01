# Vue application architecture

Updated: 2 October 2026. Owner: #1. Foundation: #3/#22. Completed increment: #6 / merged PR #41.

## Implementation status after PR #50

| Layer           | Implemented on main                                                | Remaining owner                        |
| --------------- | ------------------------------------------------------------------ | -------------------------------------- |
| App/root        | Shared footer, HomeView and ReaderView through RouterView          | Shell behavior #43 in review             |
| Styling         | Tailwind semantic Light/Dark tokens and responsive shell           | #43 accessibility/status refinement    |
| State           | Pinia explicit theme; view-local sample selection/sidebar collapse/status presentation | Library state #9; reading metadata #13 |
| Routing         | Hash home/app/fallback with Vite BASE_URL                          | Future document routes as needed       |
| Reader contract | Typed PDF page/zoom and EPUB CFI/font contracts                    | Engines #10/#12                        |
| File access     | Not implemented                                                    | #8/#9                                  |
| Persistence     | Light/Dark choice in localStorage; no reading-data persistence     | #13                                    |

#6/#46/#42/#49 are merged. Shell metadata is clearly labeled demonstration content; no file discovery or reader implementation is claimed.

## Implemented foundation flow (#6)

```mermaid
flowchart TD
  View["HomeView / ThemePicker"] --> Store["Pinia theme store"]
  Store --> Preferences["Validated local preference"]
  Store --> Runtime["Theme runtime"]
  Runtime --> Root["Root theme attributes"]
```

| Module                            | Responsibility                                     | Boundary                                           |
| --------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| src/App.vue                       | Root view composition and footer                   | No file enumeration or reader engines              |
| src/views/HomeView.vue            | Foundation content                                 | Calls UI controls, identifies unavailable features |
| src/components/ThemePicker.vue    | Labeled System/Light/Dark selection                | Calls the theme action                             |
| src/stores/theme.ts               | Preference, OS appearance and resolved theme       | Does not manipulate reader content                 |
| src/services/theme-preferences.ts | Validate/read/write papertrail.theme.v1            | Storage failure returns a session-safe fallback    |
| src/services/theme-runtime.ts     | Apply theme, listen for OS changes, return cleanup | Started before mount, disposed during HMR          |
| src/router/index.ts               | Hash routes under import.meta.env.BASE_URL         | No host rewrite dependency                         |
| src/types/reader.ts               | Format-specific adapter types                      | Not an engine implementation                       |

Light/Dark are explicit choices; System mode is removed in #46. Missing, invalid and legacy System storage values fall back to Light. Blocked storage does not stop theme changes. Theme choice is intentionally shared by production and previews on the same origin; future reading metadata must be namespaced by base path.

## UI architecture work for #7

- #42: component boundaries, responsive sidebar/workspace/toolbar and clearly labeled demonstration content.
- #43: keyboard/focus behavior and empty/loading/error/demo state presentation. ReaderView owns transient shell presentation and announcements; ShellStatus renders explicit view-only states. Escape from the library closes it and restores focus to the toggle. These states do not model file selection, indexing or reader services.
- #37: real-browser E2E infrastructure and acceptance execution, rather than duplicating it in both UI children.

#7 implementation remains Backlog during the documentation audit. Each child PR must record component ownership, props/events, state transitions, accessibility evidence and the related docs changes.

Components should render state through explicit props and emit user intent. Application services or Pinia actions own workflows. Reader/library services own document work. Do not let the sidebar access the filesystem directly, or couple the root component to PDF.js/epub.js.

## Planned provider and reader layers

LibraryProvider will isolate user-triggered selection, capabilities, indexing, access, refresh and reselection. Browser handles are optional; directory/file inputs remain fallbacks. No provider implementation is claimed yet.

PDF and EPUB engines will share lifecycle/navigation/progress/contents boundaries but expose different controls. PDF uses fixed pages and zoom/fit; EPUB uses CFI locations and typography. Reader adapters must release worker/render tasks and Blob URLs when switching. IndexedDB migrations, identity reconciliation and stored positions belong to #13.

## Documentation practice

Update this document and architecture.md when ownership or public contracts change. Update tests and issue/PR references together. Record accepted architecture decisions separately from planned work; preserve the roadmap PDF as a planning snapshot.

## Appearance refinement (#46)

The sun/moon button uses native button keyboard activation, aria-pressed for Dark mode, a visible focus ring and decorative SVG icons. Pinia contains Light/Dark only; theme-runtime watches explicit state with no matchMedia listener. Existing Light/Dark preferences persist; legacy System resolves to Light. This supersedes the original #6 System behavior.

## Reader shell and entry (#42/#49)

HomeView remains the foundation landing page, with Go to app routing to ReaderView at /app. ReaderView owns sample selection and sidebar visibility; layout/library/viewer children use explicit props/events and slots. See [shell-layout.md](shell-layout.md) for module ownership and responsive rules. #43 implements the accessibility/status increment on its feature branch; #37 remains browser E2E infrastructure. Status state is view-only: future library/reader services expose workflow state through their own contracts rather than mutating shell presentation directly.

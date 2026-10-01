# Browser-first architecture

UI: Vue 3 + TypeScript. Build: Vite. Styling/state/routing: Tailwind, Pinia and Vue Router are implemented on main through merged PR #41.

Components call application services and Pinia actions. A planned LibraryProvider will abstract file selection, indexing, read access, capability checks and refresh. The planned BrowserLibraryProvider will use File/Blob objects and optional directory handles. A future TauriLibraryProvider will implement native access behind the same boundary.

PDF and EPUB readers remain separate adapters behind a shared reader contract: open, close, navigation, progress, contents and supported controls. Planned PDF.js integration (#10) uses a worker and lazy visible-page rendering; planned epub.js integration (#12) handles reflow and CFI navigation. Neither engine is implemented yet.

Planned versioned IndexedDB (#13) will store document identity, reading positions, bookmarks and preferences. Use generated IDs and lazy fingerprints to reconcile reselected/moved files; handle ambiguous matches explicitly. Avoid whole-library eager hashing. Handle unavailable/cleared storage and quota errors.

Revoke Blob URLs and dispose readers on switching. Bound EPUB archive processing; disable book scripting and restrict remote resources. Validate malformed/password PDFs and unsupported EPUB content.

Folders: src/components/{layout,library,viewer}; src/features/{library,pdf,epub,bookmarks}; src/{composables,router,stores,types,views,assets}; tests/{unit,e2e}; docs/; .github/. Add src-tauri only in the later desktop phase.

## Browser access contract

LibraryProvider abstracts capabilities, selection, enumeration, reads, refresh and permission/reselection. FileSystemDirectoryHandle is an optional enhancement. FileList plus webkitRelativePath is the folder-snapshot path. Individual file input is the minimum fallback. Store reading metadata in IndexedDB; do not assume handles grant permanent permission or metadata grants access to file bytes.

## Later desktop integration

Issue #4 implements TauriLibraryProvider after web release. Readers, state and UI remain shared. No Rust package or Tauri runtime is required for the browser app.

## Architecture documentation

See [Vue application architecture](vue-architecture.md) for module/state ownership and PR #41 boundaries. See [Deployment architecture](deployment-architecture.md) for CI artifacts, trusted publishing and pages-state. UI shell children #42/#43 remain backlog under #7; implementation remains Backlog during this documentation audit.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
- https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath

## M1 theme, routing and reader boundaries (#6)

Tailwind's Vite plugin compiles semantic canvas, panel, ink, muted, brand and line utilities from CSS custom properties in src/assets/main.css. Light and dark palettes share spacing/radius tokens. The deployment footer consumes the same palette.

Pinia owns theme preference and resolved appearance; theme-preferences.ts validates the versioned localStorage key papertrail.theme.v1 and tolerates unavailable storage. theme-runtime.ts applies the resolved theme before mounting, listens for OS changes in System mode and returns cleanup for listeners/watchers. Explicit Light/Dark overrides OS appearance. Preferences are local to the browser origin, so production and previews share the theme choice.

Router uses hash history with Vite BASE_URL, avoiding static-host rewrite requirements at production and preview paths. The foundation view is separated from the root/router/footer. The interactive split shell is #7.

src/types/reader.ts defines format-specific navigation, progress, contents and adapter operations. PDF uses fixed pages and zoom/fit controls; EPUB uses CFI locations and typography controls. Both expose open/close/navigation/progress/contents through a generic contract. These types do not provide a working reader engine; PDF.js/epub.js implementations belong to #10/#12. File access/provider behavior remains #8/#9.

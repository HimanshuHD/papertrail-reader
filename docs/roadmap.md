# PaperTrail web-first roadmap

Revision 4 - 2 October 2026. Current release: PDF-only; EPUB follows in the next version. Decision: #30. Parent: #1. Supersedes the desktop-first plan.

[Complete PDF](PaperTrail-Web-First-Roadmap.pdf)

## 1. Browser product scope

Folder selection must follow user interaction. Feature-detect showDirectoryPicker; it requires a secure context and is not universally available. Support directory file input with webkitdirectory and relative paths; fall back to selecting individual PDF/EPUB files.

Browser selection is a permission boundary, not unrestricted hard-drive access. Directory inputs return snapshots of files; the app cannot promise continuous filesystem watching. Refresh a live handle when available or ask for reselection. The browser/OS picker may enumerate before files reach the app; cancellation applies to app indexing after selection.

Saved metadata does not guarantee future file access. Reuse persisted handles only where supported and after checking permissions; otherwise restore reading state once the user reselects matching files. Do not store full documents by default.

P0: folder/file selection, incremental indexing, tree, single reader, loading/error/empty states, PDF page navigation/progress/zoom/fit/scroll/search/contents. EPUB chapters/contents/font controls are deferred to the next version.

P1: positions, bookmarks, search, text selection, outlines, fullscreen, keyboard controls and themes.

P2/P3: annotations, statistics, tabs, session restoration, split view, annotation export and more formats.

PDF has fixed pages. EPUB uses chapters, CFI/location and percentage; reflow changes any displayed pagination. OCR for image-only PDFs and DRM-protected EPUB support are outside 0.1.

## 2. Architecture and persistence

UI: Vue 3 + TypeScript. Build: Vite. Styling/state/routing: Tailwind, Pinia and hash-based Vue Router are implemented in the foundation.

Components call application services and Pinia actions. A LibraryProvider abstracts file selection, indexing, read access, capability checks and refresh. BrowserLibraryProvider uses File/Blob objects and optional directory handles. A future TauriLibraryProvider will implement native access behind the same boundary.

PDF and EPUB readers remain separate adapters behind a shared reader contract: open, close, navigation, progress, contents and supported controls. PDF.js uses a worker and lazy visible-page rendering. epub.js handles reflow and CFI navigation.

Versioned IndexedDB stores document identity, reading positions, bookmarks and preferences. Use generated IDs and lazy fingerprints to reconcile reselected/moved files; handle ambiguous matches explicitly. Avoid whole-library eager hashing. Handle unavailable/cleared storage and quota errors.

Revoke Blob URLs and dispose readers on switching. Bound EPUB archive processing; disable book scripting and restrict remote resources. Validate malformed/password PDFs and unsupported EPUB content.

Folders: src/components/{layout,library,viewer}; src/features/{library,pdf,epub,bookmarks}; src/{composables,router,stores,types,views,assets}; tests/{unit,e2e}; docs/; .github/. Add src-tauri only in the later desktop phase.

## 3. Milestones M0-M2

M0 - Engineering foundation (#2, #3, #5; children #21, #22, #35, #37, #52)
Repository docs #2, frontend bootstrap #3 and tooling parent #5 are completed. Merge tracking #21, quality checks/tests #22, preview policy #35, explicit browser E2E #37 and fast-CI policy #52 are accepted. Exit criteria are met for the browser foundation; Tauri #4 and Rust #23 remain deferred.

M1 - UI and state (#6, #7)
Tokens, explicit Light/Dark themes, Pinia/Router and format capability contracts (#6/#46) are completed. Responsive split layout/sidebar/toolbar #42 and home/app entry #49 are completed in PR #50. Keyboard/focus and explicit empty/loading/error/demo status states #43 are completed in PR #53. Parent #7 is completed after explicit Chromium acceptance in run 36924070741. Exit: keyboard access, focus visibility and small-window usability verified; sample content clearly identified.

M2 - Browser library (#8, #9; children #24, #25)
#8 source selection is completed in PR #54. #24 incremental discovery is completed in PR #55: selected sources normalize into PDF/EPUB documents with preserved relative paths, recursive handle traversal, progress, yielding, cancellation and recoverable partial results. #25 completed hierarchy rendering, local-document selection, live-handle refresh and explicit snapshot reselection in merged PR #57. M2 browser-library scope is complete.

Exit: nested files, empty selections, permission denial, picker dismissal, unsupported APIs, Unicode paths and large selected libraries handled. Browser selection boundaries are respected. Individual-file fallback never invents directory paths.

Dependencies: #8 follows #3/#6; #24 follows #8; #25 follows #24/#7. #9 is complete only when both child scopes pass acceptance.

## 4. Milestones M3-M5

M3 - PDF reader (#10, #11)
#10 is completed with PDF.js worker assets, lazy pages/text layer, current/total pages, jump/slider, continuous scrolling, zoom/fit and resource cleanup. #11 outlines/contents, text search, selection guidance, fullscreen and shortcuts are merged in PR #60. #61 verifies browser acceptance; #62–#64 refine PDF UI.
Exit: navigation stays synchronized; obsolete render tasks cancel; password/corrupt files recover; text search limitation for scanned pages is explicit; resources released.

M4 - EPUB reader (#12) — deferred to next version
Integrate epub.js behind the reader contract. Add chapters/contents, fonts, reading themes and CFI progress. Restrict scripts/remote resources and handle malformed archives.
Exit: reading position survives font/window changes; location generation does not freeze UI; contents navigation works.

M5 - Productivity (#13, #14, #15)
For the PDF release ship IndexedDB PDF reading positions/bookmarks #13. Match reselected files before restoration; handle cleared storage and unavailable permissions. Follow with recents/library search #14 and annotations/statistics #15.
Exit: bookmarks and positions restore after reopening/reselection; migrations and ambiguous identity are tested. Library search is distinguished from document search. Annotation selectors and migration behavior are tested before notes ship.

Dependencies: #10 follows #7/#9; #11 follows #10; #12 follows #7/#9; #13 PDF persistence follows #9/#10; EPUB persistence follows #12 in the next version. M5 expansion must not silently become a first-release blocker.

## 5. Milestones M6-M7 and desktop later

M6 - Browser reliability (#16)
Measure scan/index throughput, first-page latency, rendering and memory against a named device/browser and fixture set. Verify resource cleanup, large PDFs/EPUBs, corrupt files, archive bounds, cancellation and restore failures.
Exit: recorded budgets; responsive indexing; no sustained memory growth when switching; recovery paths verified. Release-relevant checks apply to 0.1 even though full performance expansion continues.

M7 - Web release and expansion (#17, #18, #19)
Web release #19: reviewed static production build/deployment #26 and supported-browser validation #28. Agree hosting and deployment audience before publishing. Verify HTTPS, worker URLs, base paths and release notes.
Tabs/session restoration #17 follow the first release, with isolated viewer state and inactive-resource limits. Split view/export #18 follow annotations and tabs.

Desktop phase - later (#4; children #23, #27)
Reuse the web UI and readers with TauriLibraryProvider. Add Rust filesystem commands/capabilities, native compile/testing #23 and installer/signing/notarization #27. Create concrete packaging/platform tasks when desktop scope is approved. These issues remain deferred, not completed, and do not block web 0.1.

No current desktop installer or signing claim is made. Browser compatibility is declared from actual tested versions and selection fallbacks, not from an assumption that all APIs exist everywhere.

## 6. GitHub workflow and issue tracking

GitHub-first development continues: issue -> branch from main -> issue-linked commits -> PR -> CI -> review -> merge. No setup required on the owner's computer.

Frontend CI: clean npm ci from the committed lockfile, strict Vue/config type checks and production build. #22 delivered lint, formatting and meaningful unit/component tests. #37 is completed: explicit Chromium acceptance covers the shell, keyboard/focus, selection fallbacks and discovery behavior. #52 keeps browser installation/execution out of automatic Frontend CI. Browser E2E covers selection fixtures, navigation, persistence and fallbacks. Rust CI waits for the desktop phase.

Post-merge #21: reconcile completed issue evidence, parent checklists and docs/progress.md/roadmap.md. Real merge verification passed in run 36887472079. Keep partial and deferred issues open.

Status lifecycle: Backlog -> In progress -> In review -> Completed. Also use Blocked or Deferred with explicit reasons. PRs use Closes only for completed scope and Refs for partial work. Completed history is retained.

Issue parent mapping: #5 -> #21/#22/#35/#37; #7 -> #42/#43/#49; #26 -> #31/#32/#44/#47; #9 -> #24/#25; #19 -> #26/#28; deferred #4 -> #23/#27. Current connector uses reciprocal links/task lists rather than native sub-issue relations.

Commit lockfiles, pin action SHAs and restrict token permissions. Release publication must respect agreed audience. Private GitHub source is not proof of private hosting.

Current after merged PR #60: M0–M3 implementation is complete. #61 verifies PDF browser acceptance; #62 → #63 → #64 refines PDF UX, then PDF persistence #13. EPUB #12 is deferred to the next version. Tauri remains deferred.

## 7. Release acceptance and sources

Current PDF release checklist

- Explicit folder or file selection yields the correct supported-document list/tree.
- Folder capability fallback and permission/dismissal states work.
- PDF navigation/progress/zoom/search/contents work. EPUB chapters/CFI/font controls are next-version acceptance.
- Search/contents and basic accessibility are verified.
- Positions/bookmarks restore after permission checks or file reselection.
- Corrupt, password, missing and unsupported files have recoverable states.
- Document contents are processed client-side without upload.
- Storage clearing, quota errors and resource cleanup are tested.
- Clean install/type/build and appropriate lint/test/E2E checks pass.
- Tested browser versions, limitations, HTTPS delivery and deployment audience are documented.

Browser targets: current Chrome/Edge, Firefox and Safari at release time. Test feature detection and fallbacks on each; record exact versions. Mobile support remains to be declared from testing, not assumed.

Authoritative references (checked 1 October 2026)
MDN: showDirectoryPicker - limited availability, secure context, user activation.
https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
MDN: webkitdirectory and File.webkitRelativePath - directory selection and relative hierarchy.
https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath
Vue TypeScript tooling: https://vuejs.org/guide/typescript/overview
Vite guide: https://vite.dev/guide/

The live GitHub roadmap and issue acceptance criteria remain authoritative for current progress.

## Live issue checklist

- [ ] [#28 [M7] Supported-browser release validation](https://github.com/HimanshuHD/papertrail-reader/issues/28)
- [ ] [#26 [M7] Web build, HTTPS deployment and release artifacts](https://github.com/HimanshuHD/papertrail-reader/issues/26)
- [x] [#25 [M2] Directory tree and browser library refresh UI](https://github.com/HimanshuHD/papertrail-reader/issues/25)
- [x] [#24 [M2] Incremental browser indexing and cancellation](https://github.com/HimanshuHD/papertrail-reader/issues/24)
- [x] [#22 [M0] Frontend quality checks and test coverage](https://github.com/HimanshuHD/papertrail-reader/issues/22)
- [x] [#21 [M0] Automate post-merge issue and progress reconciliation](https://github.com/HimanshuHD/papertrail-reader/issues/21)
- [ ] [#19 [M7] Web release readiness and delivery](https://github.com/HimanshuHD/papertrail-reader/issues/19)
- [ ] [#18 [M7] Optional split view and annotation export](https://github.com/HimanshuHD/papertrail-reader/issues/18)
- [ ] [#17 [M7] Document tabs and session restoration](https://github.com/HimanshuHD/papertrail-reader/issues/17)
- [ ] [#16 [M6] Browser performance, reliability and document safety](https://github.com/HimanshuHD/papertrail-reader/issues/16)
- [ ] [#15 [M5] Annotations, highlights and reading statistics](https://github.com/HimanshuHD/papertrail-reader/issues/15)
- [ ] [#14 [M5] Recent documents and library search](https://github.com/HimanshuHD/papertrail-reader/issues/14)
- [ ] [#13 [M5] Browser document identity, saved positions and bookmarks](https://github.com/HimanshuHD/papertrail-reader/issues/13)
- [ ] [#12 [M4] EPUB reader and reflow controls](https://github.com/HimanshuHD/papertrail-reader/issues/12)
- [x] [#11 [M3] PDF search, contents and reader shortcuts](https://github.com/HimanshuHD/papertrail-reader/issues/11)
- [x] [#10 [M3] PDF.js reader, navigation and zoom](https://github.com/HimanshuHD/papertrail-reader/issues/10)
- [x] [#9 [M2] Browser document discovery and directory tree](https://github.com/HimanshuHD/papertrail-reader/issues/9)
- [x] [#8 [M2] Browser folder/file selection and permission handling](https://github.com/HimanshuHD/papertrail-reader/issues/8)
- [x] [#7 [M1] Split reader layout and accessible app shell](https://github.com/HimanshuHD/papertrail-reader/issues/7)
- [x] [#6 [M1] Design tokens, themes and application state](https://github.com/HimanshuHD/papertrail-reader/issues/6)
- [x] [#5 [M0] Configure web code quality, tests and GitHub Actions](https://github.com/HimanshuHD/papertrail-reader/issues/5)
- [x] [#3 [M0] Bootstrap Vue 3, Vite and TypeScript](https://github.com/HimanshuHD/papertrail-reader/issues/3)
- [x] [#2 [M0] Repository documentation and issue tracking](https://github.com/HimanshuHD/papertrail-reader/issues/2)

## Deferred desktop phase

- [ ] [#4 [Desktop later] Integrate Tauri 2 desktop shell](https://github.com/HimanshuHD/papertrail-reader/issues/4)
- [ ] [#23 [Desktop later] Rust formatting, lint and native test pipeline](https://github.com/HimanshuHD/papertrail-reader/issues/23)
- [ ] [#27 [Desktop later] Desktop signing and notarization](https://github.com/HimanshuHD/papertrail-reader/issues/27)

## Continuous deployment increment

GitHub Pages is selected. Main deploys to root after successful CI; manual PR deployments update preview/pr-N; closed previews link back to main. See [deployment.md](deployment.md). #31 tracks pipeline activation; #32 tracks versioned release promotion. GitHub Pages is enabled. Production and active/retired preview paths were verified in #31; see deployment-verification.md.

## Deployment policy refinement (#35)

CI runs on every PR update; previews publish manually at review checkpoints. Main auto-publishes website changes; documentation-only main pushes skip publishing. Closed unmerged PR lookup is repaired in PR #36. PR #36 is merged; closed previews #34/#36 are retired. #35 is completed, including documentation-only main filtering verified after PR #45.

## Frontend tooling increment (#22)

ESLint, Prettier, Vitest/Vue Test Utils and type-checked component tests join the single frontend workflow. Preserve Node deployment tests. Browser E2E #37 is completed with explicit Chromium evidence. Parent #5 is completed. Foundation #6, layout/home entry #42/#49, focus/status #43, source selection #8, discovery #24 and library tree/refresh #25 are completed. Parent #9 and PDF #10/#11 are complete; follow-ups #61–#64 are next.

## Current milestone snapshot after PR #50

Engineering/bootstrap #2/#3/#21/#22/#30, deployment foundation #31/#35/#39, theme/routing foundation #6/#46, initial version footer #47 and responsive shell/home entry #42/#49 are completed. M0 parent #5 and M1 parent #7 are completed. M2 #8/#9/#24/#25 is completed; M3 #10/#11 are merged; PDF acceptance/UI follow-ups #61–#64 remain. #26/#19 remain partial: release promotion #32, queue reconciliation #44, PDF worker delivery and supported-browser release acceptance are still open.

Version 0.1.0 records the initial foundation; the existing PDF is a planning snapshot. This Markdown roadmap and live issues carry current completion status. See [progress.md](progress.md), [browser-testing.md](browser-testing.md) and [branch-maintenance.md](branch-maintenance.md). Tauri remains deferred.

## Automatic CI policy (#52)

Browser/OS installation and Playwright execution no longer run on each PR/main build. Ordinary checks/build remain automatic. Use the retained browser suite explicitly at review milestones. The Browser E2E workflow runs only by manual dispatch or when a draft PR is marked Ready for review. Run 36924070741 is recorded acceptance evidence for focus, selection and discovery; automatic CI remains browser-free.

## PDF UI increment and revised release scope

Current release excludes EPUB #12; defer EPUB engine and CFI acceptance to the next version. PDF-only saved pages/bookmarks #13, reliability #16, delivery #26/#32/#44 and browser acceptance #28 remain release work.

Implement #62 viewport sizing/independent scrolling, then #63 compact library controls, then #64 right Contents/Search panel, icon toolbar and closable search/help popovers. #61 owns the current verification and post-#60 reconciliation. Keep unknown viewer bugs pending reproducible reports.

PR lifecycle: create draft → resolve lint/format/unit/type/build errors → mark Ready for review once → explicit Browser E2E → review/merge. Ordinary frontend CI stays browser-free. The PDF roadmap document remains a historical planning snapshot; this Markdown and live issues carry the revised scope.

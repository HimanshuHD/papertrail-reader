# PaperTrail

**Your documents. Your space. A better way to read.**

A local-first browser document reader built with Vue 3, Vite and TypeScript. Select a folder, browse its PDF and EPUB files in a narrow directory sidebar, and read one document in the main workspace. Tabs and additional formats follow later.

## Current status

The Vue 3 + Vite + TypeScript foundation shows an accessible status screen. Folder selection, PDF/EPUB rendering and the document library and readers are still planned. Repository documentation was completed in PR #20.

## Frontend commands

GitHub Actions installs dependencies and verifies the build; no setup is required on your computer. For future developer use with Node.js 24.12+ (24.x):

```sh
npm ci
npm run dev
npm run type-check
npm run build
npm run preview
```

`build` includes strict Vue and Vite-config type checks. The initial frontend CI checks clean installation and build; lint and test coverage are tracked in #22.

## Planned technology

| Area         | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| Frontend     | Vue 3, Vite, TypeScript                                                 |
| UI and state | Tailwind CSS, Pinia, Vue Router                                         |
| File access  | Browser File/Blob APIs; optional directory handles with input fallbacks |
| Readers      | PDF.js and epub.js behind separate adapters                             |
| Validation   | Vitest, Vue Test Utils, Rust checks, Playwright                         |
| Automation   | GitHub Actions                                                          |

## Reading experience

- Explicit folder selection and recursive PDF/EPUB discovery.
- Hierarchical directory tree and a single reader workspace.
- PDF page count, page jump, progress slider, zoom and fit modes.
- EPUB chapters, contents, font controls and location-based progress.
- Saved reading positions, bookmarks, search and keyboard navigation.
- Later: annotations, document tabs, split view and annotation export.

PDF pages are fixed. EPUB locations reflow with fonts and window size; a fixed page count is not assumed. Document contents stay local; uploads are not required for reading.

## Roadmap and documentation

Start at [docs/README.md](docs/README.md). Read the [complete roadmap PDF](docs/PaperTrail-Web-First-Roadmap.pdf), [live progress tracker](docs/progress.md) and [development workflow](docs/development.md).

[Roadmap issue #1](https://github.com/HimanshuHD/papertrail-reader/issues/1) tracks all product milestones. The first release targets M0-M4 plus saved positions and bookmarks from M5. Advanced productivity and multi-document work follows.

## GitHub-first development

No local setup is required on the owner's computer. Source changes use issue-linked branches and pull requests. Frontend CI validates the foundation. Expanded quality/web quality checks remain in #5 and its child issues. Browser compatibility and permission/reselection paths require real-browser validation.

See [CONTRIBUTING.md](CONTRIBUTING.md) for issue status, commit references, validation and completion rules.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

## Web-first scope

The first release is a browser app. Folder access is user-selected and capability-based: optional showDirectoryPicker under HTTPS, directory-input snapshots, and individual-file fallback. Saved reading state may require files to be reselected. Documents are processed client-side without upload.

Tauri #4, Rust checks #23 and desktop signing #27 are deferred to a later desktop phase. Next work is frontend quality #22 and state/UI #6, then browser selection #8. Hosting and deployment audience are decided before publishing (#26).

## Website deployment

GitHub Pages pipeline is in [PR #33](https://github.com/HimanshuHD/papertrail-reader/pull/33). Main builds deploy the website root; manual requests deploy successful PR builds to isolated preview/pr-N paths on the same hostname. Closed previews display a link back to main. Live deployment awaits Pages enablement and pipeline merge; see [deployment guide](docs/deployment.md). Release promotion is tracked in #32.

Preview policy refinement: PR #36 (#35) changes previews to on-demand publishing. CI remains continuous; use Actions -> Publish website -> Run workflow on main -> pr_number after the refinement merges.

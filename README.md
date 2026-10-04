# PaperTrail

**Your documents. Your space. A better way to read.**

PaperTrail is a local-first PDF and EPUB reader that runs in your browser, built with Vue 3, Vite and TypeScript. Select a folder or PDF/EPUB files, browse the library, and read without uploading documents. The published v1.0.0 release is PDF-only; current main also includes reflowable EPUB reading.

## Current product

- Browser folder and file selection with fallback paths for browser capability differences.
- Hierarchical PDF/EPUB library with independent scrolling and a responsive reader workspace.
- PDF page navigation, progress, zoom, fit modes, continuous scrolling, text search and outline navigation.
- Reflowable EPUB chapters with safe local formatting/images, optional text-only view and fixed side navigation.
- Fullscreen PDF reading, keyboard shortcuts and accessible loading/error states.
- Local document processing; files are not sent to a server.

Release v1.0.0 was deployed and verified at b2eb932 after merged release PR #103. Subsequent main deployments retain version 1.0.0; see the deployment verification ledger for their current source/run evidence. Stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) is published at that exact commit. #79/#80/#1 are completed; Roadmap 2 #78 is in progress; PDF continuity and the first EPUB renderer are merged. [Release records](docs/releases/README.md) track successive versions and validation.

## Run and verify

Use Node.js 24.12+ (24.x):

```sh
npm ci
npm run dev
npm run check
npm run build
npm run test:e2e
```

Browser E2E uses the Playwright version pinned in package-lock. CI runs the fast frontend checks on pull requests and runs Browser E2E only when a reviewed `release` or `release/*` PR targeting `main` opens or becomes ready. Feature PRs use ordinary CI; browser acceptance is recorded before release.

## Roadmap and documentation

Start at [docs/README.md](docs/README.md). See the [historical roadmap PDF snapshot](docs/roadmaps/PaperTrail-Web-First-Roadmap.pdf), [roadmap](docs/roadmaps/product-roadmaps.md), [live progress tracker](docs/trackers/progress.md), [Vue architecture](docs/architecture/vue.md), and [deployment guide](docs/deployment/publishing.md).

Issue [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1) tracks first release v1.0.0. [Roadmap 2 #78](https://github.com/HimanshuHD/papertrail-reader/issues/78) holds unfinished expansion scope after the release, including remaining EPUB #12, annotations and release reliability. PDF saved positions/bookmarks #13 is completed; desktop integration remains separately deferred.

## Production and previews

Production: [himanshuhd.github.io/papertrail-reader](https://himanshuhd.github.io/papertrail-reader/). Successful builds merged to main publish automatically. PR previews publish on demand from Actions → Publish website with the PR number. See [deployment verification](docs/deployment/verification.md) for source SHAs and run evidence.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

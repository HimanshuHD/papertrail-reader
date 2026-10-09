# PaperTrail

**Your documents. Your space. A better way to read.**

PaperTrail is a local-first PDF and EPUB reader that runs in your browser, built with Vue 3, Vite and TypeScript. Select a folder or PDF/EPUB files, browse the library, and read without uploading documents. Stable v2.0.0 includes PDF/EPUB reading, persistent reading state, bookmarks, highlights, notes and local reading insights.

## Current product

- Browser folder and file selection with fallback paths for browser capability differences.
- Hierarchical PDF/EPUB library with independent scrolling and a responsive reader workspace.
- PDF page navigation, progress, zoom, fit modes, continuous scrolling, text search and outline navigation.
- Reflowable EPUB chapters with safe local formatting/images, optional text-only view and fixed side navigation.
- Fullscreen PDF reading, keyboard shortcuts and accessible loading/error states.
- Local document processing; files are not sent to a server.

Stable [v2.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.0.0) is published against exact release merge `d995c806d93725f990636ce0899388c613cb2bbb`. See [release records](docs/releases/README.md) for support, limitations and validation.

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

Plan work through [Wiki Roadmaps](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmaps), [milestones](https://github.com/HimanshuHD/papertrail-reader/milestones) and issue acceptance checklists. Repository roadmap/progress files are historical snapshots.

Technical guides and evidence remain at [docs/README.md](docs/README.md), including [Vue architecture](docs/architecture/vue.md) and [deployment guidance](docs/deployment/publishing.md).

## Production and previews

Production: [himanshuhd.github.io/papertrail-reader](https://himanshuhd.github.io/papertrail-reader/). Successful builds merged to main publish automatically. PR previews publish on demand from Actions → Publish website with the PR number. See [deployment verification](docs/deployment/verification.md) for source SHAs and run evidence.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

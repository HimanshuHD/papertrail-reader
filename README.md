# PaperTrail

**Your documents. Your space. A better way to read.**

PaperTrail is a local-first PDF reader that runs in your browser, built with Vue 3, Vite and TypeScript. Select a folder or PDF files, browse the library, and read without uploading documents. The first release is PDF-only; EPUB is planned for the next version.

## Current product

- Browser folder and file selection with fallback paths for browser capability differences.
- Hierarchical PDF library with independent scrolling and a responsive reader workspace.
- PDF page navigation, progress, zoom, fit modes, continuous scrolling, text search and outline navigation.
- Fullscreen reading, keyboard shortcuts and accessible loading/error states.
- Local document processing; files are not sent to a server.

The PDF utility-panel and compact-toolbar refinement is in progress in [issue #64](https://github.com/HimanshuHD/papertrail-reader/issues/64). The library panel interaction refinement in #63/#72 is complete in [PR #71](https://github.com/HimanshuHD/papertrail-reader/pull/71).

## Run and verify

Use Node.js 24.12+ (24.x):

```sh
npm ci
npm run dev
npm run check
npm run build
npm run test:e2e
```

Browser E2E uses the Playwright version pinned in package-lock. CI runs the fast frontend checks on pull requests and runs Browser E2E for review-ready changes.

## Roadmap and documentation

Start at [docs/README.md](docs/README.md). See the [complete roadmap PDF](docs/PaperTrail-Web-First-Roadmap.pdf), [roadmap](docs/roadmap.md), [live progress tracker](docs/progress.md), [Vue architecture](docs/vue-architecture.md), and [deployment guide](docs/deployment.md).

Issue [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1) tracks the product roadmap. PDF reading is the current release; EPUB #12 is deferred to the next version. Persistent positions and bookmarks are tracked in #13.

## Production and previews

Production: [himanshuhd.github.io/papertrail-reader](https://himanshuhd.github.io/papertrail-reader/). Successful builds merged to main publish automatically. PR previews publish on demand from Actions → Publish website with the PR number. See [deployment verification](docs/deployment-verification.md) for source SHAs and run evidence.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

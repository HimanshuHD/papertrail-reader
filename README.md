# PaperTrail

**Your documents. Your space. A better way to read.**

PaperTrail is a local-first PDF reader that runs in your browser, built with Vue 3, Vite and TypeScript. Select a folder or PDF files, browse the library, and read without uploading documents. The first release is PDF-only; EPUB is planned for the next version.

## Current product

- Browser folder and file selection with fallback paths for browser capability differences.
- Hierarchical PDF library with independent scrolling and a responsive reader workspace.
- PDF page navigation, progress, zoom, fit modes, continuous scrolling, text search and outline navigation.
- Fullscreen reading, keyboard shortcuts and accessible loading/error states.
- Local document processing; files are not sent to a server.

The PDF utility and library refinements are complete. The first major release v1.0.0 now follows a bug-fix and release-validation pass in #79/#80. The current deployed version stays 0.1.0 until release preparation.

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

Issue [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1) tracks first release v1.0.0. [Roadmap 2 #78](https://github.com/HimanshuHD/papertrail-reader/issues/78) holds unfinished expansion scope after the release, including PDF saved positions/bookmarks #13, EPUB #12 and later Tauri integration.

## Production and previews

Production: [himanshuhd.github.io/papertrail-reader](https://himanshuhd.github.io/papertrail-reader/). Successful builds merged to main publish automatically. PR previews publish on demand from Actions → Publish website with the PR number. See [deployment verification](docs/deployment-verification.md) for source SHAs and run evidence.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

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

Production runs **v2.2.0 — Multiple-document workspace** after owner-reviewed #245 and verified deployment. Latest published GitHub Release: [v2.1.1](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.1); v2.2.0 tag/package/publication remains tracked in #244. See [release records](docs/releases/README.md) for support, limitations and validation.

## Run and verify

Use Node.js 24.12+ (24.x):

```sh
npm ci
npm run dev
npm run check
npm run build
npm run test:e2e
```

Browser E2E uses the Playwright version pinned in package-lock. Ready PRs run frontend candidate checks; drafts do not. Staging merges run Browser E2E against the verified staging artifact. Ready `release/*` and `hotfix/*` PRs targeting `main` run production-candidate Browser E2E on every accepted revision. Deployment promotes matching validated artifacts instead of rebuilding unrelated content.

## Roadmap and documentation

Plan work through [Wiki Roadmaps](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmaps), [milestones](https://github.com/HimanshuHD/papertrail-reader/milestones) and issue acceptance checklists. Repository roadmap/progress files are historical snapshots.

Technical guides and evidence remain at [docs/README.md](docs/README.md), including [Vue architecture](docs/architecture/vue.md) and [deployment guidance](docs/deployment/publishing.md).

## Production and previews

Production: [himanshuhd.github.io/papertrail-reader](https://himanshuhd.github.io/papertrail-reader/). Validated release/hotfix merges to main promote production; staging merges publish the separate staging URL after browser acceptance. Eligible ready PR previews publish on demand from Actions → Publish website with target branch, preview operation and PR number. See [delivery operations](docs/deployment/publishing.md) for bootstrap, owner settings, hotfixes, recovery and rollback. See [deployment verification](docs/deployment/verification.md) for source SHAs and run evidence.

## License

No license has been selected. Do not assume open-source licensing or redistribution permission.

Developer tooling: [Opt-in reader diagnostics](docs/development/diagnostics.md) (development/explicit diagnostic builds only; excluded from normal production builds).

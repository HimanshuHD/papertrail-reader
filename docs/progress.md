# Project progress

Updated: 1 October 2026. Web-first decision: #30. Parent: #1.

Latest verified merge: [#40](https://github.com/HimanshuHD/papertrail-reader/pull/40) at 2026-10-01T17:29:27Z; commit `26eb4ff7e4a9364d477111d1374594a7f512acb5`.

## Current increment

PR #38 completed #22. See the reconciled issue table below for remaining work.

## Issue tracker

| Issue                                                            | Phase         | Work                                                     | Status                   | Depends on                      |
| ---------------------------------------------------------------- | ------------- | -------------------------------------------------------- | ------------------------ | ------------------------------- |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2)   | Web           | Repository documentation and issue tracking              | Completed | See issue                       |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3)   | Web           | Bootstrap Vue 3, Vite and TypeScript                     | Completed | #2                              |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4)   | Desktop later | Integrate Tauri 2 desktop shell                          | Deferred - desktop phase | After web release               |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5)   | Web           | Configure web code quality, tests and GitHub Actions     | In progress | #3                              |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6)   | Web           | Design tokens, themes and application state              | Backlog | #3                              |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7)   | Web           | Split reader layout and accessible app shell             | Backlog | #6                              |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8)   | Web           | Browser folder/file selection and permission handling    | Backlog | #3; #6                          |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9)   | Web           | Browser document discovery and directory tree            | Backlog | #8; #7                          |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | Web           | PDF.js reader, navigation and zoom                       | Backlog | #7; #9                          |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | Web           | PDF search, contents and reader shortcuts                | Backlog | #10                             |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | Web           | EPUB reader and reflow controls                          | Backlog | #7; #9                          |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | Web           | Browser document identity, saved positions and bookmarks | Backlog | #9; #10; #12                    |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | Web           | Recent documents and library search                      | Backlog | #9; #13                         |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | Web           | Annotations, highlights and reading statistics           | Backlog | #11; #12; #13                   |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | Web           | Browser performance, reliability and document safety     | Backlog | Released reader/library scope   |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Web           | Document tabs and session restoration                    | Backlog | #13; release reliability checks |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Web           | Optional split view and annotation export                | Backlog | #15; #17                        |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | Web           | Web release readiness and delivery                       | Backlog | Web M0-M4; #13; #26; #28        |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | Web           | Automate post-merge issue and progress reconciliation    | Completed | #3; real merge                  |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | Web           | Frontend quality checks and test coverage                | Completed | #3                              |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | Desktop later | Rust formatting, lint and native test pipeline           | Deferred - desktop phase | After web release               |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | Web           | Incremental browser indexing and cancellation            | Backlog | #8                              |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | Web           | Directory tree and browser library refresh UI            | Backlog | #24; #7                         |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | Web           | Web build, HTTPS deployment and release artifacts        | In progress | #3; hosting/audience decision   |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | Desktop later | Desktop signing and notarization                         | Deferred - desktop phase | After web release               |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | Web           | Supported-browser release validation                     | Backlog | Web reader scope                |
| [#30](https://github.com/HimanshuHD/papertrail-reader/issues/30) | Web           | Adopt web-first scope                                    | Completed | #29 merge                       |

## Scope and completion rules

Web 0.1 is M0-M4 plus #13 and release-relevant reliability checks, with web delivery #26 and browser validation #28. #4/#23/#27 stay open and deferred; they do not block web delivery. Parent/child mappings: #5 -> #21/#22/#35/#37; #9 -> #24/#25; #19 -> #26/#28; desktop #4 -> #23/#27.

Post-merge automation reconciles closed completed issues and docs on main. It does not mark deferred or partial scope completed. Keep live issue state authoritative, and update evidence after each merge. Child relationships use reciprocal references/checklists.

## Deployment work

| Issue                                                            | Phase | Work                             | Status    | Depends on                           |
| ---------------------------------------------------------------- | ----- | -------------------------------- | --------- | ------------------------------------ |
| [#31](https://github.com/HimanshuHD/papertrail-reader/issues/31) | Web   | Main deployment and PR previews  | Completed | #26; Pages enablement; eligible plan |
| [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32) | Web   | Versioned releases and promotion | Backlog | #31; release acceptance              |

Deployment design: [deployment.md](deployment.md). Main root plus preview/pr-N paths use one hostname. Production and preview URLs are verified; policy-specific checks are tracked in #35.

Pipeline review: PR #33. Live production and preview verification completed in #31; release promotion remains #32.

## Verified deployment channels

- Production: https://himanshuhd.github.io/papertrail-reader/
- Retired verification preview: https://himanshuhd.github.io/papertrail-reader/preview/pr-34/
- Retired preview: https://himanshuhd.github.io/papertrail-reader/preview/pr-33/
- Evidence: [deployment-verification.md](deployment-verification.md).
- PR #34 was closed without merging and its preview retirement was verified after run 36895110066. Issue #31 is completed; #26/#32 release scope remains open.

## Pipeline refinement

PR #36 merged at `6302efc`. Merge tracking run 36894959027 passed. Retried PR #34 closure CI; trusted publisher 36895110066 passed and the live URL now shows a retired page. PR #36's preview also retired. Main production publishing was retried after GitHub cancelled a queued publisher run during overlapping cleanup events. Publisher 36895563022 passed; live production metadata reports `6302efc316501a89f69431e1e838316c3ae5f1d9`.

#35 remains In progress until a manual current-head preview, an unchanged preview after a later PR push, and documentation-only main filtering are verified live. Policy tests passed; do not confuse unit evidence with live deployment acceptance.

## Frontend quality increment

#22 is implemented on `chore/22-frontend-quality`: ESLint, Prettier, Vitest/Vue Test Utils, type-checked component tests and existing deployment tests in the single frontend CI workflow. PR #38 is in review; its first GitHub CI run 36895851991 passed. #5 stays open; new child #37 tracks real browser E2E once shell/selection behavior exists.

Next after the tooling merge: #6 design tokens/themes/state, then #7 accessible shell and #8 browser selection. Tauri remains deferred.

## Additional tracked children

| Issue | Work                                             | Status                                                  | Depends on                                 |
| ----- | ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------ |
| #35   | On-demand previews and publication filtering     | In progress; PR #36 merged, live checks partly verified | Manual preview and docs-only main evidence |
| #37   | Browser E2E foundation and selection smoke tests | Backlog                                                 | #22; #7; #8                                |

PR #38's automatic publisher selects skip for an open PR. Manual preview verification remains pending; no active preview is promised until published.

## Deployment identifier footer (#35, PR #38)

CI embeds the source head SHA and PR number at build time. The footer shows Preview / PR number with a short SHA linked to the full commit, or Production / main with its SHA. Local builds without CI metadata show Development / SHA unavailable. Rerun Publish website with PR number 38 after the new head passes CI to inspect this footer; the existing preview stays on its previously published build until manual deployment.

## Preview presentation polish (#39)

Separate branch: `feat/39-preview-status`. Retirement uses a self-contained responsive PaperTrail status page with PR identity, a production action and a pull-request link. It has no dependency on removed preview assets. Existing retired URLs retain their old design until retirement is rerun after this renderer reaches main.

PR artifacts include `preview-closed.html` only for PR builds, generated by the same renderer with an explicit Design preview badge. After manually publishing this PR, append `/preview-closed.html` to its preview URL to inspect the design before merging. The normal preview app remains active. The trusted publisher continues to load its retirement renderer from main.

The app footer now shows a linked source branch for previews and production. CI supplies the PR head branch or main at build time; links preserve branch slashes and encode individual URL segments. #6 is paused until this increment is reviewed.

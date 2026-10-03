# Documentation inventory and migration — #106

Source: main `975eef80ea4fdf47f6e4dbd4ce7ae6011205489c`, inventoried 3 October 2026. Roadmap owner: [#78](https://github.com/HimanshuHD/papertrail-reader/issues/78).

| Previous path                                    | Canonical path                                   | Compatibility                                  |
| ------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `docs/roadmaps/product-roadmaps.md`              | `docs/roadmaps/product-roadmaps.md`              | Markdown migration pointer retained            |
| `docs/trackers/progress.md`                      | `docs/trackers/progress.md`                      | Markdown migration pointer retained            |
| `docs/trackers/status-audit.md`                  | `docs/trackers/status-audit.md`                  | Markdown migration pointer retained            |
| `docs/trackers/first-release-bugs.md`            | `docs/trackers/first-release-bugs.md`            | Markdown migration pointer retained            |
| `docs/trackers/branch-maintenance.md`            | `docs/trackers/branch-maintenance.md`            | Markdown migration pointer retained            |
| `docs/architecture/overview.md`                  | `docs/architecture/overview.md`                  | Markdown migration pointer retained            |
| `docs/architecture/vue.md`                       | `docs/architecture/vue.md`                       | Markdown migration pointer retained            |
| `docs/architecture/reader-shell.md`              | `docs/architecture/reader-shell.md`              | Markdown migration pointer retained            |
| `docs/architecture/deployment.md`                | `docs/architecture/deployment.md`                | Markdown migration pointer retained            |
| `docs/development/workflow.md`                   | `docs/development/workflow.md`                   | Markdown migration pointer retained            |
| `docs/development/browser-testing.md`            | `docs/development/browser-testing.md`            | Markdown migration pointer retained            |
| `docs/development/workflow-audit.md`             | `docs/development/workflow-audit.md`             | Markdown migration pointer retained            |
| `docs/deployment/publishing.md`                  | `docs/deployment/publishing.md`                  | Markdown migration pointer retained            |
| `docs/deployment/verification.md`                | `docs/deployment/verification.md`                | Markdown migration pointer retained            |
| `docs/evidence/loading-feedback.md`              | `docs/evidence/loading-feedback.md`              | Markdown migration pointer retained            |
| `docs/evidence/reader-polish.md`                 | `docs/evidence/reader-polish.md`                 | Markdown migration pointer retained            |
| `docs/evidence/search-highlighting.md`           | `docs/evidence/search-highlighting.md`           | Markdown migration pointer retained            |
| `docs/getting-started/contributing.md`           | `docs/getting-started/contributing.md`           | Markdown migration pointer retained            |
| `docs/roadmaps/PaperTrail-Web-First-Roadmap.pdf` | `docs/roadmaps/PaperTrail-Web-First-Roadmap.pdf` | Original PDF retained; identical snapshot blob |

## Preserved paths

`docs/releases/` retains its five release records/index/template at their original paths. Only navigation is added; release identity, run evidence and historical prose remain. `docs/screenshots/` retains all six tracked PNG blobs unchanged. `docs/licenses/lucide.txt` retains its attribution blob unchanged. Root README and CHANGELOG retain their paths. There are no AGENTS.md files in the inventoried tree.

## New maintained guides

The central index and category indexes list usage, local setup, roadmap milestones, Roadmap 3, issue/label/milestone policy, documentation conventions, and this migration map. `docs/assets/README.md` explains asset placement; existing screenshots stay at stable URLs. No VitePress or separate documentation publishing is introduced.

## Repository automation

The merge reconciliation workflow must write `docs/trackers/progress.md` and `docs/roadmaps/product-roadmaps.md`; the PR template points at the canonical tracker. Scripts using sample docs paths for deployment-policy tests remain valid fixtures. #106 contains a necessary workflow-path edit, so it is not a pure docs-only event-filter acceptance test. Use a subsequent docs-only change to verify #100 without weakening workflow change eligibility.

---

[Previous](documentation-conventions.md) · [Documentation home](../README.md)

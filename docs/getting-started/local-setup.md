# Local setup

Use Node.js 24.12 or newer within the 24.x line, matching package.json and CI. From the repository root:

```bash
npm ci --no-audit --no-fund
npm run dev
```

Run `npm run check` for lint, formatting, pipeline/unit tests and type checks. Run `npm run build` for a production build; `npm run preview` serves that build locally.

Browser tooling is deliberate acceptance work. Do not install browsers just to edit documentation. When validating reader behavior, follow [Browser testing](../development/browser-testing.md). Remote Frontend CI remains the review gate for GitHub-first contributions.

Start changes from current main and link them to an issue. See [Contributing](contributing.md) and the [development workflow](../development/workflow.md).

---

[Previous](usage.md) · [Documentation home](../README.md) · [Next](contributing.md)

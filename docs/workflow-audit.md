# Workflow trigger audit

Audit: 2 October 2026. Owner: #61. Current baseline: PR #60.

| Event                                | Expected work                                                        | Browser install          | Publication                                               |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| Draft PR opened / updated / reopened | Frontend CI lint/format/tests/types/build                            | No                       | Publisher wrapper selects skip; no preview deployment     |
| PR marked Ready for review           | Separate Browser E2E                                                 | Yes, once per transition | No publisher subscription to Browser E2E                  |
| Manual Browser E2E dispatch          | Explicit acceptance on selected branch                               | Yes                      | No                                                        |
| Main push after merge                | Frontend CI build                                                    | No                       | Website changes publish production; docs-only build skips |
| PR closed                            | Lightweight Frontend CI retirement job; merge tracker only if merged | No                       | Publisher retires PR preview while preserving production  |
| Feature branch push without PR       | No current push workflow subscription                                | No                       | No                                                        |
| Manual Publish website               | Trusted successful main or open PR artifact                          | No                       | Explicit production/preview publication                   |

## Observed evidence

- PR #60 final head `3363ee51`: Frontend CI 36963712036 passed. Publisher wrapper 36963755843 ran checkout/selection only; artifact download, assembly, upload and Pages deployment were skipped. A successful workflow badge does not mean deployment.
- Main merge `e159ab14`: Frontend CI 36964378879 passed. Publisher 36964422783 downloaded/verified a production artifact and deployed it.
- PR closure CI 36964379100 triggered publisher 36964390169, which retired preview #60 without downloading a new production artifact. Aggregate Pages deployment is expected for retirement.
- Merge tracker 36964378918 reconciled issue/checklist status. Tracking-only main successor `908cbc08` is distinct from the deployed website source.
- Browser E2E 36963474599 ran on Ready-for-review at an earlier head and failed with ambiguous selectors; it is not automatic per commit. #61 fixes remaining Next ambiguity after the search-status correction in #60.

No unintended preview publication or browser install was found on ordinary PR updates in the sampled runs. Publish website wrappers do still start after successful PR CI and exit after selection; this is a redundant selection job, not an unintended deployment. Avoid changing closure handling merely to hide these entries. Durable overlapping publisher recovery remains #44.

## PR lifecycle

Create a draft and wait for fast Frontend CI. Resolve every failure before moving out of draft. Mark Ready for review once to trigger explicit Browser E2E; do not also manually dispatch the same acceptance. Keep this audit separate from UI implementation #62–#64.

# Approved channel visual baselines

The active references are the 108 PNGs under `tests/visual/baselines/channels/`: 36 per preview, staging and production channel. Each `approval.json` retains the exact approval URL, source/head/tree/run/artifact identities, verified artifact ZIP digest, pinned browser environment and individual PNG hashes. The channel registry rejects missing, substituted or mismatched references. The legacy shared manifest remains disabled; its superseded PNGs are archived.

Corrected captures were reviewed by the assistant under explicit owner delegation and approved in [#193 comment 6207977275](https://github.com/HimanshuHD/papertrail-reader/issues/193#issuecomment-6207977275). Reference run [38849187000](https://github.com/HimanshuHD/papertrail-reader/actions/runs/38849187000) captured head `feb1b6104389dc35f11e8eac174f5e85d948b242`, merge source `08d3d43d32e68373d30b127535f2583f5ca07364`, tree `49b4b28d8dec5856f9de325dc138868688a366dc`. This does not claim personal owner inspection of each image.

The hidden-library capture requires the sidebar to be removed and the reader to fill the layout. Preview retains its review caption; staging/production retain “Startup steps”. Pixel thresholds remain 0.15 / maxDiffPixels 20, with automatic snapshot updates disabled.

## Historical evidence archive

`papertrail-193-historical-evidence.zip` is retained separately as the owner-accessible archive supplied in the #212 cleanup chat. Its filename and digest are recorded in issue #193 and PR #212. It preserves all 190 original evidence files and 36 superseded shared PNGs from commit `c2119579ef791a7983dd0aaec0563bdb8538fa7c`, including approval records, sidecars, original capture-time statuses and the lossless original-report chunks. None of those historical failures or pending statuses were rewritten as passes.

- ZIP size: 17,830,557 bytes.
- ZIP SHA-256: `c7eb85e526aab44de188cd2ae40bcf6a78de07e53eea3574fc66ecd03ed1c6e8`.
- `ARCHIVE-MANIFEST.json` records the source commit and SHA-256 of every archived file. All 226 entries were verified after ZIP creation.
- To reconstruct the original HTML report after extracting the archive, join `docs/evidence/visual-193-approved/comparison.html.gz.part-*` in numbered order and decompress with gzip. The archived original README describes the historical layout.

CI reads only the committed active PNGs/manifests; it does not need the archive or expiring workflow artifacts. Explicit local preparation with `scripts/prepare-channel-baselines.mjs ARTIFACT_ZIP REVIEW_JSON` validates both source captures and provenance before writing approved references. Generated sidecars/statuses go to ignored `visual-evidence/channel-preparation-history/` for separate archival retention, not the repository documentation tree. CI self-adoption remains forbidden.

Owner review/merge and post-merge integration acceptance remain separate. See #193 for the current acceptance checklist and historical evidence links.

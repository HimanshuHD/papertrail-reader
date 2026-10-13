# Startup visual QA — #171

Source visual truth: owner's 1586×992 loading mock and 1254×1254 sprite, attached 13 October 2026.

Implementation: public/startup assets, early index.html screen and src/assets/startup.css.

Viewport: desktop 1586×992 plus supported mobile widths; rendered screenshots pending.

State: genuine cold startup, reduced motion and recoverable bootstrap failure.

Full-view/focused comparison evidence: source images opened; implementation browser screenshot unavailable. sites-preview is running, but cloud navigation to http://terminal.local:4173/ returned ERR_BLOCKED_BY_CLIENT. No visual comparison or interaction/console result is inferred from a build.

Required fidelity surfaces: typography, spacing, colors, image quality and copy are implemented from the supplied design but remain unverified in rendered comparison. The supplied sprite and brand raster are used; no replacement illustration was generated.

Findings: blocking lack of browser-rendered evidence. Local service/build checks are recorded separately; browser fixtures provide screenshots for subsequent staging acceptance.

Implementation checklist: capture desktop/mobile loading state, compare beside the mock, verify retry/reduced motion and console, address visual differences, then record passed.

Comparison history: no completed rendered comparison.

final result: blocked

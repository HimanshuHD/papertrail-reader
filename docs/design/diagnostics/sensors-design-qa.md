# Sensors tab visual and interaction verification

Date: 21 October 2026. Scope: approved Sensors prototype applied to the existing Vue diagnostics panel in PR #255.

## Reference

[sensors-prototype.html](./sensors-prototype.html), [editable source fragment](./sensors-prototype-fragment.html), [captured prototype image](./sensors-prototype.png). The reference contains simulated data. Its capture uses the existing product icons for the inline host's icon placeholders.

## Verification

The reference capture and actual Vue panel capture were inspected at the same736px viewport/light appearance/Inputs selection. The application uses actual captured readings, so values, sample counts, graph shape and neutral evaluation status differ from the simulation. The existing bounded-height panel, fixed header/footer and scrolling body are preserved rather than stretching the overlay to fit the full reference image.

- Six main views: Overview, Sensors, Operations, Resources, Timeline, Technical details; evaluation status and header/footer behavior retained.
- Sensors header, capture checkbox, three category controls, latest duration with smaller unit, zero-based retained-observation trend, median/worst/p95 row, unstacked breakdown and informational note match the selected hierarchy.
- “How to read this / captured evidence” expands for each category. Verified actual API status, count/threshold/rounding, partial iframe coverage, long-frame overlap, resource category/transfer/encoded sizes and interpretation guidance.
- Selected main view and sensor category survive minimize/reopen. Pause stops observations; Reset clears readings; existing private JSON export and production exclusion remain tested.
- Actual application checked in light and375px dark appearance; five-width browser suite covers320/375/768/1024/1440px. No horizontal overflow or browser page errors observed.
- Real input/frame/resource capture and nested keyboard navigation passed. Native focus styles and accessible controls retained; header/footer continue using one custom tooltip, without native button titles.
- No simulated values are imported by runtime source. Missing readings remain unavailable and p95 requires20 retained observations. Source-specific metrics do not change the health indicator.

Method: local Chromium153 with the existing isolated Playwright binary. No cloud browser, automatic Visual QA run, baseline adoption, cross-browser certification or total-overhead certification is claimed.

Final result: passed for the scoped local visual/interaction checks. Owner preview/merge and exact merged-source staging acceptance remain pending; broader workload/accessibility/engine acceptance remains #253/#16.

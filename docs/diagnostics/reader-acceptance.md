# Reader lifecycle and accessibility acceptance

This is a **manual-only functional suite**, separate from profiling, Visual QA and
workflows. It uses generated documents. Actual native OS permissions and personal
or real-device document checks remain manual.

## Run

Use Node 24, installed dependencies and the desired Playwright browsers/OS
dependencies, then run:

```sh
npm run test:reader:acceptance
```

Chromium is the default. To select all engines:

```sh
READER_ACCEPTANCE_ENGINES=chromium,firefox,webkit npm run test:reader:acceptance
```

PowerShell:

```powershell
$env:READER_ACCEPTANCE_ENGINES = 'chromium,firefox,webkit'
npm run test:reader:acceptance
```

Keep the machine awake and environment undisturbed. Each engine needs at least five
real minutes for expiry, plus other cases. Only the new expiry case has an
allowance for this wait; existing action assertions/retries remain unchanged. No
clock acceleration, GC or performance budget is used.

The command builds one diagnostics-enabled production-mode bundle in a temporary
directory. Vite receives paths directly, including Windows paths with spaces.
Private reports go to ignored `browser-evidence/reader-acceptance/run-*/`.
`summary.json` records source SHA/tree/dirty state, engines and status;
`playwright.json` retains case results and attachments. A failure, flake or skip
prevents a passed summary. Missing engines fail rather than disappear. Temporary
builds are removed afterward. Dirty-source runs are development evidence, not
identical-source release acceptance. Review reports before sharing.

## Functional scope

| Check                    | What it establishes                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real inactivity          | Warm PDF/EPUB instances survive switches; after at least five actual inactive minutes their old instances leave the DOM; the active reader survives; recreated readers restore PDF page and EPUB chapter. |
| Closure                  | Recreated readers can be closed and their mounted roots disappear. Not proof of heap/process/GPU cleanup.                                                                                                 |
| Pending local-file work  | Closing either format while a test-only local-read barrier is pending cannot revive its tab or block recovery. Not an OS-file cancellation certification.                                                 |
| Reload/reselect          | Existing mixed restoration, changed-content isolation, delayed-reselect/Forget cancellation and legacy migration cases.                                                                                   |
| Controlled picker errors | Existing cancel/deny/unavailable handling preserves an open reader and permits directory-input fallback. Injected failures are not native prompts.                                                        |
| Instrumented teardown    | Existing owner/release tests. Registered counters are not a universal no-leak verdict.                                                                                                                    |
| Keyboard/layout          | Six named diagnostic panels; valid ARIA references; arrow/Home/End navigation; Escape focus return; actual light/dark themes at 320/768/1440; descriptive chart alternatives and viewport bounds.         |

This does not certify screen-reader speech, contrast, all interactions or all
devices. Visual comparison remains separately and manually invoked.

### Keyboard and semantic follow-up

The Operations table has a named, focusable scroll region. Tab from Operations to
the table and use arrow keys when it overflows; Shift+Tab returns to its tab.
Timeline filters form a named group, and each timestamp exposes “since page start”
as readable text instead of relying on an unsupported ARIA label on `time`.

A scoped local axe-core 4.11 audit covered six top-level views at 320/1440 in both
themes after finite animations settled. It found no remaining violations in those
states after the scroll-region and Timeline fixes. Narrow-layout heading/caption
contrast checks remained incomplete and require manual review, not a pass. The
audit used initial panel states; it does not certify every populated chart,
interaction, contrast combination or screen reader. No audit dependency or
automatic workflow was added. The six existing manual keyboard cases now cover
the scroll region and Timeline semantics as functional regressions.

## Remaining installed-browser checklist

Use the disposable generated native folders in [diagnostics acceptance](acceptance.md).
Record pass/fail or unavailable with a reason on the actual supported browser/OS.
Controlled picker tests cannot check off these rows.

- [ ] Grant access to the 100-file folder; verify listing, nested groups and opening.
- [ ] Repeat with 1,000 files and verify search and continued reader use.
- [ ] Cancel the actual picker with a document open; library/tab/position survive.
- [ ] Reload a remembered native handle; no unsolicited prompt; record the actual
      granted/prompt/denied path.
- [ ] Deny/revoke access through installed-browser controls; explicit reconnect
      gives understandable feedback and reselection restores access.
- [ ] On unsupported engines verify real directory-input selection; record
      reselection requirements rather than claiming persisted native permission.
- [ ] Read representative real PDF/EPUB files through navigation, reload, resize,
      text-only mode and tab switching. Keep document identity private.
- [ ] Check keyboard focus and screen-reader tab/panel names, status/recovery
      messages and chart alternatives in light/dark and narrow/wide views.

Record source, browser/OS, date, native-versus-fallback path and each outcome. Keep
raw profiles/documents private. Unexecuted rows stay unchecked. Profiling, accepted
budgets and engine-retention investigation continue separately.

## EPUB view-mode persistence regression (#276)

The manual suite includes both formatted and text-only final modes. Each case
switches modes, changes to a PDF and back, then performs a normal reload and
explicit local-file reconnect. It checks chapter and mode restoration without
synthetic pagehide events or an added save-delay sleep. The unit regression checks
that a completed explicit mode change starts persistence without waiting for the
scroll-save debounce. Ordinary reading/scroll writes remain debounced.

For preview review, repeat with a representative real multi-chapter EPUB: navigate
to a later chapter, enable then disable text-only view, resize, switch to a PDF
and back, reload and reconnect the same files. Verify the formatted mode and
chapter survive. Repeat leaving text-only enabled. Also verify the PDF's page and
zoom survive. Keep document names/content and raw browser evidence private.

Mode changes also retain a partially visible reading passage when author styling
uses much taller lines than text-only mode. The generated long-chapter regression
checks the same source text in both directions after switching. A cross-mode text
anchor with an old negative line offset is aligned to the viewport top instead of
being hidden above it; same-mode pixel offsets and end-of-chapter behavior remain.

## Reader viewport spacing (#279)

Approved author CSS declaration lengths using `vh`, `vw`, `vmin`, `vmax` and their
small/large/dynamic variants are bound to host-owned reader dimensions. They no
longer use the expanded chapter iframe as their viewport. Ordinary author margins,
units and formatting remain intact. This conversion does not redefine CSS media
query evaluation; it applies to approved declaration values, including inline
styles and declarations inside media rules.

The manual suite covers a generated long chapter with `20vh` leading space in
both stylesheet and inline styles. It checks the computed margin against 20% of
the visible reader height, resizing, mode switches from blank space and a reading
passage, and reload/reconnect. Existing mode-persistence cases remain separate.
The passage check uses an exact character offset within the stable source node so
repeated wording cannot select a different occurrence.

For preview, repeat with a real EPUB containing author viewport-based chapter
spacing. Verify the opening margin is proportional to the reader, then scroll to
a recognizable passage and toggle modes, resize, switch tabs and reload/reconnect.
Keep raw documents, names and browser reports private. Installed Firefox/WebKit
validation remains required where local browser prerequisites are unavailable.

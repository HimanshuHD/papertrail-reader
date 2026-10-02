# Reader polish — #86 and #87

Parent #79; first release roadmap #1. This combined increment preserves #85 screenshots and merge evidence alongside control/footer refinements. #89 search excerpts/highlighting and final regression remain before #80. Version remains 0.1.0.

## Controls and motion

The page-number field adds 8px inline margins beyond the toolbar gap, clearing its 2px outline with 4px offset. The main-header Appearance label is removed; Dark mode keeps its accessible name and pressed state. Utility mode buttons expose aria-pressed and show the selected state through a tinted background, brand border/underline and bold ink text in both themes.

Library and utility panels enter and leave over 320ms with cubic-bezier(0.22, 1, 0.36, 1). Search/help and source menus use 240ms with the same easing; icon tooltips use 180ms. Actions update immediately without artificial waits. Leaving surfaces are inert, and entering surfaces remove inert for interrupted/reversed transitions. A departing utility panel is positioned out of flex layout. Its Close/Escape action restores focus to Contents; existing search/help, library and source-menu focus/dismissal behavior remains. Reduced-motion preferences remove transitions.

## Footer

The footer uses 4px vertical and 12px horizontal padding, smaller row gaps, a pane-colored background and divider, muted text and brand links. Links retain a 24px minimum target height. Version/environment/PR/branch/SHA links remain unchanged. Long branch names wrap; the app footer's existing bounded independent overflow remains for very short windows.

## Validation

Local focused footer/theme tests and lint/format checks pass. Fresh fast CI and explicit Browser E2E evidence will be recorded before review handoff. Browser checks cover active states in both themes, input focus clearance, enter/exit motion, reduced motion, focus restoration, narrow widths and 500px height. The short-height footer stress capture injects representative link text into the actual footer CSS because the CI build omits deployment metadata; unit tests verify the real metadata template. It is a synthetic layout test, not a deployed preview capture.

The earlier centered loading screenshots and final #97 validation are preserved in [loading-feedback.md](loading-feedback.md).

---
phase: 09-dashboard-layout-overhaul-horizontal-single-page
plan: 02
subsystem: ui
tags: [react, tailwindcss, dashboard, layout, drawer, portal]

requires:
  - phase: 09-01
    provides: CourseRow component and CourseAccordion defaultExpanded prop

provides:
  - SyncDashboard horizontal single-page layout (no tab strip, two-column grid)
  - CourseDrawer without dark backdrop overlay
  - Auto-expanding accordion when course drawer opens

affects:
  - Any future dashboard plans that extend SyncDashboard layout

tech-stack:
  added: []
  patterns:
    - "Horizontal two-column grid with fixed-width left rail (280px) and flex-fill right column"
    - "Portal drawer without backdrop — course list remains fully visible while drawer is open"
    - "Conditional render of CourseDrawer to reset defaultExpanded on each open/close"

key-files:
  created: []
  modified:
    - src/components/SyncDashboard.tsx
    - src/components/CourseDrawer.tsx

key-decisions:
  - "Tab strip removed entirely — Overview/Courses merged into single scrollable page with horizontal grid"
  - "CourseDrawer backdrop (bg-black/40) removed — drawer feels like a panel, not a modal overlay"
  - "max-w-4xl (896px) replaces max-w-2xl — exploits wider desktop space for two-column layout"
  - "grid-cols-1 md:grid-cols-[280px_1fr] — single column on mobile (<768px), two-column at desktop"
  - "items-start on grid — prevents tall left rail from stretching shorter right column"

patterns-established:
  - "Left rail pattern: stat cards stacked vertically, expanded panels below stack, sync button always last"
  - "CourseRow (compact, 44px) replaces CourseCard (grid tile) in the right column"

requirements-completed: [UX-01, UX-02, UX-03, UX-04, UX-05]

duration: 9min
completed: 2026-03-20
---

# Phase 9 Plan 02: Dashboard Layout Overhaul Summary

**Single-page horizontal two-column dashboard with backdrop-free portal drawer and auto-expanding accordion, eliminating the tab strip in favor of simultaneous stat cards + course list visibility**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-20T21:05:19Z
- **Completed:** 2026-03-20T21:14:44Z
- **Tasks:** 2 executed + 1 checkpoint auto-approved
- **Files modified:** 2

## Accomplishments
- Removed `activeTab` state and tab strip from SyncDashboard — no more Overview/Courses tabs
- Replaced the two-tab JSX structure with a responsive two-column grid (`grid-cols-[280px_1fr]`)
- Left rail holds stat cards stacked vertically, expanded panels, and inline sync button
- Right column holds compact CourseRow list and school calendars below
- Removed `bg-black/40` backdrop div from CourseDrawer portal — page remains fully visible
- Passed `defaultExpanded={true}` to CourseAccordion so accordion opens immediately on drawer mount
- Replaced `CourseCard` grid usage with `CourseRow` compact rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CourseDrawer — remove backdrop, pass defaultExpanded** - `600cf2b` (fix)
2. **Task 2: Refactor SyncDashboard to horizontal single-page layout** - `86b455e` (feat)
3. **Task 3: Visual verification** - Auto-approved (auto-chain active)

## Files Created/Modified
- `src/components/CourseDrawer.tsx` - Removed backdrop div and fragment wrapper; added defaultExpanded={true} to CourseAccordion
- `src/components/SyncDashboard.tsx` - Replaced tab-based layout with horizontal two-column grid; swapped CourseCard for CourseRow; removed activeTab state and handleTabChange

## Decisions Made
- Tab strip eliminated entirely — plan called for single-page layout, no `activeTab` state needed
- `max-w-4xl` chosen over `max-w-2xl` to use available horizontal desktop space
- `items-start` on the grid container prevents the right column from stretching when the left rail is taller (e.g., expanded detail panels)
- CourseDrawer unmounts on close (conditional render) so `defaultExpanded` resets correctly on next open

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in `src/components/__tests__/CountdownPanel.test.tsx` (2 tests fail because hardcoded dates `new Date(2026, 2, 15)` are now in the past relative to today 2026-03-20). These failures are unrelated to this plan's changes and were present before this execution. Logged to deferred-items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 9 is complete. The dashboard now renders as a single horizontal page:
- No tab strip
- Left rail: stat cards (stacked) + expanded detail panels + inline sync button
- Right column: compact course rows + school calendars
- Drawer opens without backdrop; accordion auto-expands on mount

No blockers for future work.

---
*Phase: 09-dashboard-layout-overhaul-horizontal-single-page*
*Completed: 2026-03-20*

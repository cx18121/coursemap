---
phase: 09-dashboard-layout-overhaul-horizontal-single-page
plan: 01
subsystem: ui
tags: [react, tailwind, jest, typescript]

# Dependency graph
requires:
  - phase: 08-dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout
    provides: CourseAccordion, ColorPicker, GOOGLE_CALENDAR_COLORS
provides:
  - CourseRow compact component (44px row with color swatch, truncated name, event count, toggle)
  - CourseAccordion defaultExpanded prop for starting open on mount
  - CourseRow.test.tsx with 3 logic tests
  - SyncDashboard.test.tsx extended with no-tab layout state tests
affects:
  - 09-02 (SyncDashboard refactor imports CourseRow; CourseDrawer uses defaultExpanded)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - stopPropagation on both onChange and onClick of checkbox to prevent row-level click bubbling
    - min-w-0 on flex-1 span to enable truncate inside flex container
    - defaultExpanded ?? false pattern for optional boolean props with false default

key-files:
  created:
    - src/components/CourseRow.tsx
    - src/components/__tests__/CourseRow.test.tsx
  modified:
    - src/components/CourseAccordion.tsx
    - src/components/__tests__/SyncDashboard.test.tsx

key-decisions:
  - "CourseRow uses h-11 (44px) height — satisfies compact row requirement for horizontal layout"
  - "defaultExpanded?? false is backward-compatible — existing call sites omitting the prop behave identically"
  - "CountdownPanel test failures (2) confirmed pre-existing, unrelated to this plan's changes — logged as deferred"

patterns-established:
  - "Node-env pure-function test pattern: simulate component logic without React rendering (jsdom hangs on WSL/Node 22)"

requirements-completed: [UX-01, UX-03, UX-04]

# Metrics
duration: 14min
completed: 2026-03-20
---

# Phase 09 Plan 01: CourseRow Component and CourseAccordion defaultExpanded Prop Summary

**Compact 44px CourseRow component with stopPropagation toggle and CourseAccordion defaultExpanded prop — building blocks for Plan 09-02 SyncDashboard refactor**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-20T20:46:41Z
- **Completed:** 2026-03-20T21:01:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created CourseRow.tsx — compact 44px row replacing CourseCard in the horizontal layout, with color swatch, truncated course name, event count badge, and stopPropagation-protected checkbox toggle
- Added `defaultExpanded?: boolean` prop to CourseAccordion so Plan 09-02 can open the drawer accordion immediately on mount
- Created CourseRow.test.tsx with 3 node-environment logic tests (color fallback, stopPropagation, eventCount display)
- Extended SyncDashboard.test.tsx with 3 no-tab layout state tests for the expandedPanel toggle logic Plan 09-02 will implement

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CourseRow.tsx compact component** - `a3830c5` (feat)
2. **Task 2: Add defaultExpanded to CourseAccordion + write test stubs** - `17bf293` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/components/CourseRow.tsx` - New compact course row component (44px, color swatch, truncated name, event count, stopPropagation checkbox)
- `src/components/CourseAccordion.tsx` - Added `defaultExpanded?: boolean` prop and `useState(defaultExpanded ?? false)` initializer
- `src/components/__tests__/CourseRow.test.tsx` - 3 pure-function logic tests for CourseRow behavior
- `src/components/__tests__/SyncDashboard.test.tsx` - Appended 3 no-tab layout state tests to existing test file

## Decisions Made
- `h-11` (44px) chosen for row height to satisfy the ~40-48px compact row spec from 09-CONTEXT.md
- `defaultExpanded ?? false` is backward-compatible — all existing CourseAccordion call sites that don't pass the prop default to `false`, matching prior behavior exactly
- `min-w-0` on the course name span is required for Tailwind `truncate` to work inside a flex container; without it, the flex item ignores the overflow constraint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing test failures (out of scope):**
- `CountdownPanel.test.tsx` has 2 failing tests using hardcoded dates (`new Date(2026, 2, 15)`) that are now in the past (today is 2026-03-20). These failures were confirmed pre-existing before any changes in this plan. Logged to deferred-items for future cleanup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 09-02 can proceed: `import CourseRow from './CourseRow'` is now a valid import target
- `defaultExpanded={true}` can now be passed to CourseAccordion in CourseDrawer
- Test infrastructure for no-tab layout state already established in SyncDashboard.test.tsx

---
*Phase: 09-dashboard-layout-overhaul-horizontal-single-page*
*Completed: 2026-03-20*

## Self-Check: PASSED

- src/components/CourseRow.tsx — FOUND
- src/components/CourseAccordion.tsx — FOUND
- src/components/__tests__/CourseRow.test.tsx — FOUND
- src/components/__tests__/SyncDashboard.test.tsx — FOUND
- .planning/phases/09-dashboard-layout-overhaul-horizontal-single-page/09-01-SUMMARY.md — FOUND
- Commit a3830c5 — FOUND
- Commit 17bf293 — FOUND

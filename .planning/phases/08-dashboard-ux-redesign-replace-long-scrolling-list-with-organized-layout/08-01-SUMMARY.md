---
phase: 08-dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout
plan: "01"
subsystem: frontend-components
tags: [ui, glassmorphic, portal, react, typescript]
dependency_graph:
  requires: []
  provides:
    - src/components/StatCard.tsx
    - src/components/CourseCard.tsx
    - src/components/CourseDrawer.tsx
    - src/components/SyncButton.tsx (inline variant)
    - src/components/SyncSummary.tsx (inline prop)
  affects:
    - src/components/SyncDashboard.tsx (Plan 02 will wire these in)
tech_stack:
  added: []
  patterns:
    - createPortal to document.body for stacking-context escape
    - e.stopPropagation on checkbox to prevent card click propagation
    - useEffect keydown Escape listener (same pattern as ColorPicker)
key_files:
  created:
    - src/components/StatCard.tsx
    - src/components/CourseCard.tsx
    - src/components/CourseDrawer.tsx
  modified:
    - src/components/SyncButton.tsx
    - src/components/SyncSummary.tsx
decisions:
  - "CourseDrawer always renders at translate-x-0 (no mount animation) — tailwindcss-animate not installed; CSS transition-transform duration-200 for future animation"
  - "SyncButton inline variant extracts shared JSX into content variable to avoid duplication between the two branches"
  - "SyncSummary inline prop is interface-only (no JSX change) — fixed wrapper lives in SyncDashboard, not inside SyncSummary itself"
metrics:
  duration: "7 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 08 Plan 01: New UI Component Building Blocks Summary

StatCard/CourseCard/CourseDrawer created plus inline variants added to SyncButton and SyncSummary — five glassmorphic building blocks ready for Plan 02 SyncDashboard wiring.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create StatCard, CourseCard, and CourseDrawer components | 2e57433 | StatCard.tsx, CourseCard.tsx, CourseDrawer.tsx |
| 2 | Add inline prop to SyncButton and SyncSummary | da28d13 | SyncButton.tsx, SyncSummary.tsx |

## What Was Built

### StatCard.tsx
- `<button>` (for accessibility) with glassmorphic card styling
- Active state: `ring-1 ring-indigo-400/60`
- Props: `{ label, value, active, onClick }`
- Used for "Deadlines", "Synced", "Conflicts" stat cards in the Overview tab

### CourseCard.tsx
- 2-column grid card with color swatch (from `GOOGLE_CALENDAR_COLORS`), course name (`line-clamp-2`), enable toggle checkbox, event count
- Checkbox uses `e.stopPropagation()` on both `onChange` and `onClick` so the toggle does not trigger card click (drawer open)

### CourseDrawer.tsx
- Renders via `createPortal(content, document.body)` to escape backdrop-blur stacking contexts
- Backdrop: `fixed inset-0 bg-black/40 z-40` — click closes
- Panel: `fixed top-0 right-0 h-full w-full max-w-md z-50`
- Escape key listener using `useEffect` keydown pattern (same as ColorPicker.tsx)
- Wraps existing `CourseAccordion` unchanged inside drawer body

### SyncButton.tsx (modified)
- Added `inline?: boolean` prop
- `inline=true`: renders in flow `div` with `rounded-xl overflow-hidden border border-[--color-border] bg-white/5 p-4`
- `inline=false` (default): preserves existing `fixed bottom-0 left-0 right-0` wrapper
- Shared button/progress JSX extracted to `content` variable to avoid duplication

### SyncSummary.tsx (modified)
- Added `inline?: boolean` to `SyncSummaryProps` interface
- No JSX changes — the fixed wrapper is in `SyncDashboard.tsx`, not inside `SyncSummary` itself

## Verification

- `npx tsc --noEmit`: no errors (clean compile)
- `npx jest --no-coverage`: 179 passed, 2 pre-existing CountdownPanel date failures (unrelated to this plan)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/components/StatCard.tsx
- FOUND: src/components/CourseCard.tsx
- FOUND: src/components/CourseDrawer.tsx
- FOUND: src/components/SyncButton.tsx
- FOUND: src/components/SyncSummary.tsx
- FOUND commit: 2e57433 (Task 1)
- FOUND commit: da28d13 (Task 2)

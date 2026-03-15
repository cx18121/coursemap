---
phase: 04-event-type-grouping-sub-calendars-per-course-and-type
plan: 04
subsystem: ui, api
tags: [nextjs, react, drizzle, google-calendar, typescript]

# Dependency graph
requires:
  - phase: 04-event-type-grouping-sub-calendars-per-course-and-type
    provides: "typeGroupingEnabled column in users table (Plan 01), ensureTypeSubCalendar helper (Plan 02)"
provides:
  - "PATCH /api/user-settings endpoint persisting typeGroupingEnabled preference"
  - "GET /api/user-settings endpoint returning current user settings"
  - "TypeGroupingToggle React component with checkbox, type chips, aria-label"
  - "SyncDashboard renders TypeGroupingToggle above Canvas Courses section"
  - "page.tsx reads typeGroupingEnabled from DB and passes as initial prop"
  - "syncCanvasEvents accepts typeGroupingEnabled flag and routes to type sub-calendars"
  - "Sync route reads typeGroupingEnabled from user DB row and passes to syncCanvasEvents"
affects:
  - sync-pipeline
  - dashboard
  - user-settings

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic UI update with silent revert on PATCH failure (same pattern as course toggles)"
    - "Server Component reads DB preference and passes as initialX prop to Client Component"
    - "Type-routing mode in syncCanvasEvents: fan out to per-(course, type) sub-calendars when flag=true"

key-files:
  created:
    - src/app/api/user-settings/route.ts
    - src/components/TypeGroupingToggle.tsx
  modified:
    - src/app/api/sync/route.ts
    - src/components/SyncDashboard.tsx
    - src/app/dashboard/page.tsx
    - src/services/gcalSync.ts

key-decisions:
  - "syncCanvasEvents typeGroupingEnabled is optional (defaults to false) to preserve backward compatibility"
  - "Toggle PATCH uses optimistic update with silent revert on failure — matches existing course toggle UX pattern"
  - "showFirstEnableNote state is ephemeral (not persisted) — shown once per session on first enable"
  - "typeGroupingEnabled is read from users DB row in the POST /api/sync handler and passed to runSyncJob — avoids extra DB call inside runSyncJob"

patterns-established:
  - "Server reads preference from DB -> passes as initialX prop to Client Component"
  - "Client Component maintains local state initialized from initialX prop"

requirements-completed:
  - GROUP-05
  - GROUP-06

# Metrics
duration: 11min
completed: 2026-03-15
---

# Phase 04 Plan 04: Type Grouping Toggle End-to-End Summary

**TypeGroupingToggle UI wired end-to-end: PATCH /api/user-settings persists preference, SyncDashboard renders toggle above Canvas Courses, sync route reads flag from DB and routes events to type sub-calendars via syncCanvasEvents**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-15T22:36:16Z
- **Completed:** 2026-03-15T22:47:25Z
- **Tasks:** 2 (+ checkpoint pending human verification)
- **Files modified:** 6

## Accomplishments
- Created GET/PATCH /api/user-settings route with session auth and input validation
- Created TypeGroupingToggle component with accessible checkbox (aria-label, min-h-[44px], accent-indigo-500, type chips)
- Integrated TypeGroupingToggle into SyncDashboard with optimistic state + silent PATCH revert on failure
- page.tsx passes initialTypeGroupingEnabled from DB to SyncDashboard
- Extended syncCanvasEvents with optional typeGroupingEnabled 5th parameter, routing to type sub-calendars when true

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/user-settings route + pass typeGroupingEnabled through sync route** - `b93ad65` (feat)
2. **[Rule 3 - Blocking] Extend syncCanvasEvents with typeGroupingEnabled routing** - `7e44448` (fix)
3. **Task 2: TypeGroupingToggle component + SyncDashboard integration + page.tsx prop pass-through** - `fdc17db` (feat)

## Files Created/Modified
- `src/app/api/user-settings/route.ts` - GET/PATCH endpoint for user settings (typeGroupingEnabled)
- `src/components/TypeGroupingToggle.tsx` - Toggle UI with checkbox, description, and type chip badges
- `src/components/SyncDashboard.tsx` - Added TypeGroupingToggle import, state, handler, and render block
- `src/app/dashboard/page.tsx` - Reads typeGroupingEnabled from DB, passes as initialTypeGroupingEnabled prop
- `src/app/api/sync/route.ts` - runSyncJob accepts typeGroupingEnabled; POST reads from user row and passes it
- `src/services/gcalSync.ts` - syncCanvasEvents accepts optional typeGroupingEnabled; routes to ensureTypeSubCalendar when true

## Decisions Made
- syncCanvasEvents typeGroupingEnabled is optional (`boolean?`) so existing callers with 4 args work unchanged
- Optimistic toggle update with silent catch-revert — no toast on failure, matches existing course toggle pattern
- showFirstEnableNote is session-local state only (not persisted); shown once per browser session on first enable
- typeGroupingEnabled value is read from the users DB row in the POST handler (already fetched there) and passed as a parameter to runSyncJob — avoids an extra DB query inside the background job

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied missing Plan 03 work: syncCanvasEvents typeGroupingEnabled routing**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Plan 04 passes `typeGroupingEnabled` as 5th arg to `syncCanvasEvents`, but the function only accepted 4 parameters. Plan 03 was listed as a dependency but had no SUMMARY.md — it was not executed.
- **Fix:** Added optional `typeGroupingEnabled?: boolean` 5th parameter to `syncCanvasEvents`. Added `if (typeGroupingEnabled)` branch routing to `ensureTypeSubCalendar` per-(course, type), preserving bulk dedup. Added imports for `ensureTypeSubCalendar` and `CanvasEventType`.
- **Files modified:** src/services/gcalSync.ts
- **Verification:** `npx jest --no-coverage` passes (134 tests, 11 new)
- **Committed in:** `7e44448`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — Plan 03 was skipped in earlier execution. Applied the core routing logic that Plan 03 specified.

## Issues Encountered
- Pre-existing TypeScript errors in test files (colorAssignment.test.ts, syncFilter.test.ts, gcalSync.test.ts, SyncDashboard.test.tsx, schoolMirror.test.ts, titleCleanup.test.ts) from Plans 02-03 not fully resolving test mock types. These are out of scope — jest passes all 134 tests. Documented in deferred-items.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full end-to-end type grouping feature is code-complete and awaiting human verification (checkpoint)
- TypeGroupingToggle renders in dashboard above Canvas Courses section
- Toggle persists across page reloads via DB
- Sync respects the flag: type sub-calendars created when enabled, original per-course sub-calendars used when disabled
- Verification required: confirm toggle renders, persists, and that sync produces correctly-named type sub-calendars in Google Calendar

---
*Phase: 04-event-type-grouping-sub-calendars-per-course-and-type*
*Completed: 2026-03-15*

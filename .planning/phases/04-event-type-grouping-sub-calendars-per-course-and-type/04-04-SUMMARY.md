---
phase: 04-event-type-grouping-sub-calendars-per-course-and-type
plan: 04
subsystem: ui, api, database
tags: [nextjs, react, drizzle, google-calendar, typescript, neon]

# Dependency graph
requires:
  - phase: 04-event-type-grouping-sub-calendars-per-course-and-type
    provides: "courseTypeCalendars table (Plan 01), ensureTypeSubCalendar helper (Plan 02)"
provides:
  - "PATCH /api/user-settings endpoint accepting per-type sync toggles (syncAssignments, syncQuizzes, syncDiscussions, syncEvents)"
  - "GET /api/user-settings endpoint returning per-type settings"
  - "TypeGroupingToggle React component with 4 independent checkboxes (one per event type)"
  - "SyncDashboard renders TypeGroupingToggle above Canvas Courses section with per-type state"
  - "page.tsx reads per-type settings from DB and passes as initialEventTypeSettings prop"
  - "syncCanvasEvents always routes to type sub-calendars; skips events of disabled types"
  - "Sync route reads 4 per-type columns from user DB row and passes EnabledEventTypes to syncCanvasEvents"
affects:
  - sync-pipeline
  - dashboard
  - user-settings

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic UI update with silent revert on PATCH failure (same pattern as course toggles)"
    - "Server Component reads DB preferences and passes as initialX prop to Client Component"
    - "Type grouping always-on: syncCanvasEvents always routes to per-(course, type) sub-calendars; per-type flags filter which events are included"
    - "enabledEventTypes defaults all-true when omitted — backward-compatible callers need no changes"

key-files:
  created:
    - src/app/api/user-settings/route.ts
    - src/components/TypeGroupingToggle.tsx
  modified:
    - src/app/api/sync/route.ts
    - src/components/SyncDashboard.tsx
    - src/app/dashboard/page.tsx
    - src/services/gcalSync.ts
    - src/lib/db/schema.ts
    - src/services/gcalSync.test.ts

key-decisions:
  - "Type grouping is always ON — no master toggle; removed typeGroupingEnabled boolean from schema"
  - "Per-type sync filters replace global toggle: syncAssignments, syncQuizzes, syncDiscussions, syncEvents boolean columns added to users table (all default true)"
  - "Announcements grouped under syncEvents toggle (event type 'announcement' maps to syncEvents key)"
  - "EnabledEventTypes interface defaults all-true when param omitted — backward-compatible"
  - "Per-type PATCH sends a single key per toggle change rather than batching — matches optimistic update pattern"
  - "DB migration applied directly via neon serverless driver (same approach as Phase 04-01)"

patterns-established:
  - "Server reads per-type preferences from DB -> passes as EventTypeSettings object to Client Component"
  - "Client Component maintains EventTypeSettings state initialized from server prop"
  - "TYPE_TOGGLE_MAP in gcalSync.ts maps CanvasEventType literals to EnabledEventTypes keys"

requirements-completed:
  - GROUP-05
  - GROUP-06

# Metrics
duration: ~25min (continuation after design revision)
completed: 2026-03-15
---

# Phase 04 Plan 04: Type Grouping Toggle End-to-End Summary

**Per-type Canvas event sync controls: 4 individual checkboxes (Assignments, Quizzes, Discussions, Events) replace global toggle; type grouping always-on; per-type DB columns replace typeGroupingEnabled boolean**

## Performance

- **Duration:** ~25 min (original + design revision continuation)
- **Started:** 2026-03-15T22:36:16Z
- **Completed:** 2026-03-15
- **Tasks:** 3 (2 original + design revision)
- **Files modified:** 8

## Accomplishments
- Replaced `typeGroupingEnabled` boolean with 4 per-type boolean columns in users table: `sync_assignments`, `sync_quizzes`, `sync_discussions`, `sync_events` (all default true)
- Created GET/PATCH /api/user-settings route: PATCH accepts per-type keys individually; GET returns all 4 flags
- TypeGroupingToggle component redesigned as 4 independent checkboxes (one per event type) with descriptive copy
- SyncDashboard uses EventTypeSettings state; each checkbox PATCHes its key optimistically with silent revert
- page.tsx passes initialEventTypeSettings from DB to SyncDashboard
- syncCanvasEvents always routes events to type sub-calendars; events of disabled types are skipped before routing; announcements grouped under syncEvents toggle; backward-compatible (EnabledEventTypes defaults all-true)
- Sync route reads 4 per-type columns from user row and passes EnabledEventTypes struct to runSyncJob
- DB migration applied: 4 ADD COLUMN, 1 DROP COLUMN via neon serverless driver
- gcalSync.test.ts fully updated: per-type filtering tests, announcement grouping, always-on type routing (138 tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/user-settings route + pass typeGroupingEnabled through sync route** - `b93ad65` (feat)
2. **[Rule 3 - Blocking] Extend syncCanvasEvents with typeGroupingEnabled routing** - `7e44448` (feat)
3. **Task 2: TypeGroupingToggle component + SyncDashboard integration + page.tsx prop pass-through** - `fdc17db` (feat)
4. **Design revision: per-type sync filters replacing global toggle** - `f6552be` (feat)

## Files Created/Modified
- `src/app/api/user-settings/route.ts` - GET/PATCH endpoint for per-type sync settings
- `src/components/TypeGroupingToggle.tsx` - 4 per-type checkboxes with label and description
- `src/components/SyncDashboard.tsx` - Uses EventTypeSettings state; each checkbox calls handleToggleEventType
- `src/app/dashboard/page.tsx` - Reads 4 per-type columns from DB, passes as initialEventTypeSettings prop
- `src/app/api/sync/route.ts` - Builds EnabledEventTypes from user row and passes to runSyncJob
- `src/services/gcalSync.ts` - Always-on type routing; EnabledEventTypes param filters disabled types; TYPE_TOGGLE_MAP constant
- `src/lib/db/schema.ts` - Replaced typeGroupingEnabled boolean with 4 per-type boolean columns
- `src/services/gcalSync.test.ts` - Updated for always-on type grouping with per-type filtering tests

## Decisions Made
- Type grouping is always ON — removing the master toggle simplifies the mental model and aligns with the design intent
- Per-type boolean columns (`sync_*`) chosen over JSONB — simpler Drizzle schema, direct column reads, no JSON parse
- Announcements grouped under `syncEvents` toggle — the UI design lists 4 types (Assignments, Quizzes, Discussions, Events); announcements map to the Events bucket
- `EnabledEventTypes` defaults all-true when `enabledEventTypes` param omitted — backward-compatible with tests that don't pass the 5th arg
- DB migration applied directly via `@neondatabase/serverless` (same approach as Phase 04-01 — drizzle-kit lacks migration history table)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied missing Plan 03 work: syncCanvasEvents typeGroupingEnabled routing** (from original tasks)
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Plan 04 passes `typeGroupingEnabled` as 5th arg to `syncCanvasEvents`, but the function only accepted 4 parameters. Plan 03 was not executed.
- **Fix:** Added `typeGroupingEnabled?: boolean` 5th parameter and type-routing branch.
- **Files modified:** src/services/gcalSync.ts
- **Committed in:** `7e44448`

**2. [User design change — post-checkpoint] Redesigned to per-type toggles (always-on grouping)**
- **Requested during:** checkpoint:human-verify
- **Change:** Replace single global toggle with 4 per-type checkboxes; type grouping always-on; DB schema change from 1 boolean to 4 booleans
- **Fix:** Full revision of schema, API route, TypeGroupingToggle, SyncDashboard, gcalSync, sync route, tests
- **Files modified:** All 8 files listed above
- **Committed in:** `f6552be`

---

**Total deviations:** 2 (1 auto-fixed blocking, 1 user-requested design change)
**Impact on plan:** Design revision replaces the original single-toggle UX with a more granular per-type model. All code changes are minimal and coherent.

## Issues Encountered
None — TypeScript compiled clean and all 138 tests passed after revision.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full end-to-end per-type Canvas event sync is code-complete
- TypeGroupingToggle renders 4 checkboxes in dashboard above Canvas Courses section
- Per-type settings persist across page reloads via DB (all 4 new columns default true)
- Sync always routes events to type sub-calendars ("Canvas - CourseName — Assignments" etc.)
- Events of disabled types are skipped entirely during sync
- DB migration applied to Neon Postgres

---
*Phase: 04-event-type-grouping-sub-calendars-per-course-and-type*
*Completed: 2026-03-15*

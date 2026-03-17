---
phase: 07-conflict-detection
plan: 02
subsystem: api, ui
tags: [googleapis, gcal, nextjs, react, drizzle, conflict-detection, tdd]

# Dependency graph
requires:
  - phase: 07-01
    provides: gcalEventId column on syncedEvents table, populated by gcalSync on insert/update

provides:
  - GET /api/sync/conflicts endpoint with 60s grace window conflict detection
  - ConflictPanel React component with lazy fetch on expand and amber conflict badge
  - SyncDashboard mounts ConflictPanel after DedupePanel with syncVersion cache-reset key
  - 7 unit tests covering auth guards, grace window logic, deleted event handling

affects: [08-future-conflict-resolution, any phase that reads syncedEvents for conflict state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy accordion fetch pattern: expand -> fetch-if-null -> cache in state; key prop forces remount on sync complete"
    - "Batched GCal API calls: Promise.all per group of 10 to limit concurrent quota usage"
    - "Grace window constant (GRACE_MS = 60_000): suppresses false positives from sync-triggered GCal updated bumps"
    - "Defensive null guard in batch loop: skip rows with null gcalEventId even after WHERE isNotNull filter"

key-files:
  created:
    - src/app/api/sync/conflicts/route.ts
    - src/app/api/sync/conflicts/__tests__/syncConflicts.test.ts
    - src/components/ConflictPanel.tsx
  modified:
    - src/components/SyncDashboard.tsx

key-decisions:
  - "GRACE_MS = 60_000: suppresses false positives from sync-triggered GCal updated bumps (documented in Phase 7 RESEARCH.md)"
  - "Defensive null guard in batch map: skip rows with null gcalEventId before events.get call, even though WHERE filter should exclude them"
  - "key={syncVersion} on ConflictPanel: forces React remount on sync complete to clear cached conflict data without prop drilling"
  - "ConflictPanel uses amber color scheme (not indigo like DedupePanel) to visually differentiate warning state"
  - "Conflict detection is read-only (detect and display only) - resolution scoped to v1.2"

patterns-established:
  - "Lazy conflict fetch: data loaded only on accordion expand, cached in component state for subsequent expands"
  - "syncVersion state in SyncDashboard: incremented on sync complete, passed as key to panels that need cache invalidation"

requirements-completed: [CONFLICT-01, CONFLICT-02]

# Metrics
duration: 25min
completed: 2026-03-17
---

# Phase 7 Plan 02: Conflict Detection Endpoint and UI Summary

**GET /api/sync/conflicts with 60s grace window filtering, ConflictPanel collapsible UI showing Canvas title + due date + GCal modified time, wired into SyncDashboard with syncVersion-based cache reset**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-17T16:20:00Z
- **Completed:** 2026-03-17T16:45:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GET /api/sync/conflicts queries syncedEvents rows with isNotNull(gcalEventId), calls calendar.events.get per row in batches of 10, and flags events where GCal updated > syncedAt + 60s as conflicts
- ConflictPanel mirrors DedupePanel's lazy-load accordion pattern but fetches conflict data, displays an amber badge with conflict count, and lists each conflicted event with its Canvas title, due date, and GCal edit timestamp
- SyncDashboard wires ConflictPanel after DedupePanel with same visibility gate and passes key={syncVersion} to force remount (and cache clear) after each sync completes
- All 7 unit tests green; full 181-test suite passes with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/sync/conflicts endpoint with tests** - `99d86a7` (feat, TDD)
2. **Task 2: Create ConflictPanel component and wire into SyncDashboard** - `b343905` (feat)

## Files Created/Modified

- `src/app/api/sync/conflicts/route.ts` - GET endpoint: session guard, isNotNull DB filter, batched events.get calls, 60s grace window, JSON response {conflictCount, conflicts[]}
- `src/app/api/sync/conflicts/__tests__/syncConflicts.test.ts` - 7 unit tests: 401 flows, empty rows, null gcalEventId skip, conflict detected, grace window no-flag, deleted event skip
- `src/components/ConflictPanel.tsx` - Collapsible panel: lazy fetch on expand, amber badge, conflict list with Canvas title/due date/GCal modified time
- `src/components/SyncDashboard.tsx` - Added ConflictPanel import, syncVersion state, setSyncVersion in sync complete handler, ConflictPanel render block after DedupePanel

## Decisions Made

- GRACE_MS = 60_000 is a constant in the route file (not env-configurable) because it's a fixed implementation detail for suppressing GCal API false positives, not a user-tunable threshold.
- Defensive `if (!row.gcalEventId) return` added in batch loop because unit tests mock findMany to return any row we give it, revealing the route should not trust the DB to always return the correct filtered results. Safety net for any future query changes.
- `key={syncVersion}` pattern chosen over explicit cache-invalidation prop because it avoids prop drilling and uses React's built-in remount mechanism, consistent with existing patterns in the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Defensive null guard added in batch map loop**
- **Found during:** Task 1 (TDD test run - Test 3 failure)
- **Issue:** Test 3 set up findMany to return a row with gcalEventId: null (simulating the WHERE filter being mocked away in tests). The route called events.get with eventId: null. Without a guard, any row that slips past the WHERE filter would cause an API call with a null eventId.
- **Fix:** Added `if (!row.gcalEventId) return;` before the try/catch block in the batch map
- **Files modified:** src/app/api/sync/conflicts/route.ts
- **Verification:** Test 3 passed after fix; 7/7 tests green
- **Committed in:** 99d86a7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing defensive check)
**Impact on plan:** Guard makes the route more robust without changing behavior for the expected case. No scope creep.

## Issues Encountered

None - plan executed with one auto-fix deviation (defensive null guard in batch loop).

## User Setup Required

None - no external service configuration required. Conflict detection uses existing GCal OAuth tokens.

## Next Phase Readiness

- Conflict detection (CONFLICT-01, CONFLICT-02) fully delivered: count visible in dashboard, expandable list with Canvas title/due date/GCal modified time
- ConflictPanel cache resets on every sync completion via syncVersion key
- No resolution UI in this plan (scoped to v1.2 per plan objective)
- Phase 7 is the final phase of v1.1 milestone — all CONFLICT requirements satisfied

---
*Phase: 07-conflict-detection*
*Completed: 2026-03-17*

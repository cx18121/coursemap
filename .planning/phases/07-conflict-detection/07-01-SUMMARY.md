---
phase: 07-conflict-detection
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, gcal, sync]

# Dependency graph
requires:
  - phase: 06-deduplication-preview
    provides: syncedEvents DB mirror table with upsert pattern
provides:
  - gcalEventId nullable column on syncedEvents Drizzle schema
  - migrate-conflict-detection.ts ALTER TABLE migration script
  - gcalSync.ts insert/update branches storing gcalEventId after each GCal operation
affects: [07-02-conflict-detection-endpoint, conflict-detection, plan-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-insert-response-id, extract-existing-id-from-list]

key-files:
  created:
    - src/lib/db/migrate-conflict-detection.ts
  modified:
    - src/lib/db/schema.ts
    - src/services/gcalSync.ts
    - src/services/gcalSync.test.ts

key-decisions:
  - "gcalEventId is nullable (no .notNull()) — existing rows will have NULL until re-synced; safe for incremental adoption"
  - "INSERT branch captures insertResponse.data.id from calendar.events.insert return value"
  - "UPDATE branch captures existing.id from events.list response (already available at diff time)"
  - "gcalEventId stored in both .values() and .onConflictDoUpdate set — ensures re-sync overwrites stale IDs"

patterns-established:
  - "Capture GCal API response ID: const insertResponse = await calendar.events.insert(...); const gcalEventId = insertResponse.data.id ?? null"
  - "Update branch ID extraction: const gcalEventId = existing.id ?? null — extract before API call"

requirements-completed: [CONFLICT-01, CONFLICT-02]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 7 Plan 01: gcalEventId DB Column and Storage Summary

**gcalEventId nullable column added to syncedEvents schema with migration script; gcalSync.ts insert and update branches now capture and store the GCal event ID after every successful API call**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T16:12:49Z
- **Completed:** 2026-03-17T16:17:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `gcalEventId: text('gcal_event_id')` nullable column to syncedEvents Drizzle schema
- Created `migrate-conflict-detection.ts` using `ALTER TABLE ADD COLUMN IF NOT EXISTS` (safe for re-runs)
- Wired gcalEventId storage in gcalSync.ts INSERT branch via captured `insertResponse.data.id`
- Wired gcalEventId storage in gcalSync.ts UPDATE branch via `existing.id` from events.list response
- Extended gcalSync.test.ts with 3 new gcalEventId-specific tests; all 28 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gcalEventId column to schema and create migration** - `a5d99c9` (feat)
2. **Task 2 RED: Add failing tests for gcalEventId storage** - `43d2b73` (test)
3. **Task 2 GREEN: Wire gcalEventId storage in gcalSync.ts** - `20b24ef` (feat)

_Note: TDD task has two commits (test RED then feat GREEN)_

## Files Created/Modified
- `src/lib/db/schema.ts` - Added `gcalEventId: text('gcal_event_id')` nullable column to syncedEvents pgTable
- `src/lib/db/migrate-conflict-detection.ts` - NEW: ALTER TABLE migration adding gcal_event_id column
- `src/services/gcalSync.ts` - INSERT branch captures insertResponse.data.id; UPDATE branch captures existing.id; both pass gcalEventId to values() and onConflictDoUpdate set
- `src/services/gcalSync.test.ts` - Updated syncedEvents mock schema; added 3 new gcalEventId storage tests

## Decisions Made
- gcalEventId is nullable — existing rows get NULL until re-synced; allows incremental adoption without data loss
- INSERT branch captures `insertResponse.data.id` from the calendar.events.insert return value
- UPDATE branch captures `existing.id` from the already-available events.list response (no extra API call needed)
- gcalEventId stored in both `.values()` and `.onConflictDoUpdate set` to ensure re-sync overwrites stale IDs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The migration script (`src/lib/db/migrate-conflict-detection.ts`) must be run against the production database when deploying.

## Next Phase Readiness
- syncedEvents table now has gcalEventId; Plan 02 can use this column to call `events.get` per-event for conflict detection
- Migration script is safe for re-runs (IF NOT EXISTS)
- All existing tests remain green; no regression

---
*Phase: 07-conflict-detection*
*Completed: 2026-03-17*

## Self-Check: PASSED

All created/modified files exist and all task commits verified in git history.

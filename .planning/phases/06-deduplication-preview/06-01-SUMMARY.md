---
phase: 06-deduplication-preview
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, gcal-sync, db-mirror]

requires:
  - phase: 05-auto-sync-and-countdown
    provides: syncLog table pattern and Neon migration approach

provides:
  - syncedEvents Drizzle table schema with (userId, uid) composite unique index
  - migrate-synced-events.ts raw SQL migration script
  - syncedEvents upsert writes in syncCanvasEvents after each successful GCal insert/update
  - 3 new DEDUP-02 test cases verifying write/no-write behavior

affects:
  - 06-02 (preview endpoint reads syncedEvents DB mirror)

tech-stack:
  added: []
  patterns:
    - "onConflictDoUpdate with composite unique index target array [table.col1, table.col2] (Drizzle upsert pattern)"
    - "DB mirror write inside per-event try block — only writes if GCal call succeeds"

key-files:
  created:
    - src/lib/db/migrate-synced-events.ts
  modified:
    - src/lib/db/schema.ts
    - src/services/gcalSync.ts
    - src/services/gcalSync.test.ts
    - src/app/api/sync/preview/route.ts
    - src/app/api/sync/preview/__tests__/syncPreview.test.ts

key-decisions:
  - "syncedEvents upsert placed AFTER GCal API call succeeds, BEFORE summary counter increment — ensures failed GCal calls produce no mirror row"
  - "onConflictDoUpdate composite target uses [syncedEvents.userId, syncedEvents.uid] column array — matches Drizzle ORM docs and existing courseTypeCalendars pattern"

patterns-established:
  - "DB mirror upsert pattern: db.insert(table).values({...}).onConflictDoUpdate({ target: [col1, col2], set: {...} })"

requirements-completed: [DEDUP-02]

duration: 14min
completed: 2026-03-17
---

# Phase 06 Plan 01: syncedEvents DB Mirror Table Summary

**syncedEvents Drizzle table + Neon migration + upsert writes in gcalSync.ts so every successful GCal insert/update captures a Canvas event snapshot in the database**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T03:35:10Z
- **Completed:** 2026-03-17T03:49:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `syncedEvents` pgTable to schema.ts with composite unique index on (userId, uid) enabling upsert dedup
- Created `migrate-synced-events.ts` with raw SQL `CREATE TABLE IF NOT EXISTS synced_events` for Neon serverless driver
- Wired `db.insert(syncedEvents).onConflictDoUpdate()` into both insert and update branches of `syncCanvasEvents` — mirror stays current after every sync
- Added 3 DEDUP-02 test cases: writes on insert, writes on update, no write when GCal fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Add syncedEvents table schema + migration script** - `5f10be4` (feat)
2. **Task 2: Wire syncedEvents upsert into gcalSync.ts + extend tests** - `fde3ae7` (feat)

## Files Created/Modified

- `src/lib/db/schema.ts` - Added syncedEvents pgTable definition after syncLog; composite unique index on (userId, uid)
- `src/lib/db/migrate-synced-events.ts` - New file; raw SQL CREATE TABLE migration via Neon serverless driver
- `src/services/gcalSync.ts` - Added syncedEvents import; added upsert after each GCal insert/update success
- `src/services/gcalSync.test.ts` - Added mockOnConflictDoUpdate mock; added syncedEvents to schema mock; added 3 DEDUP-02 test cases
- `src/app/api/sync/preview/route.ts` - Fixed hasChangedVsSnapshot parameter type (start/end: Date, matching CanvasEvent interface)
- `src/app/api/sync/preview/__tests__/syncPreview.test.ts` - Fixed makeCanvasEvent factory to use Date objects

## Decisions Made

- syncedEvents upsert goes AFTER the GCal API call and BEFORE the summary counter — this is the critical ordering that ensures a failed GCal call leaves no mirror row
- Used `onConflictDoUpdate` with composite `target: [syncedEvents.userId, syncedEvents.uid]` array — same pattern as courseTypeCalendars which is already proven working

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed hasChangedVsSnapshot parameter type in preview/route.ts**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `hasChangedVsSnapshot` expected `{ start: string; end: string }` but `CanvasEvent` has `start: Date; end: Date`, causing TS2345 error
- **Fix:** Changed parameter type to accept `CanvasEvent` directly, using `.getTime()` comparison instead of `Date.parse(string)`
- **Files modified:** src/app/api/sync/preview/route.ts, src/app/api/sync/preview/__tests__/syncPreview.test.ts
- **Verification:** `npx tsc --noEmit` passes with no source file errors; all 171 tests pass
- **Committed in:** fde3ae7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for TypeScript compilation; no scope creep.

## Issues Encountered

- A linter/formatter repeatedly attempted to revert the type fix in `route.ts` (switching `Date` back to `string`). Used `Write` tool to ensure the correct version persisted.

## User Setup Required

Run the migration script against your Neon database before next sync:

```bash
npx ts-node --project tsconfig.json src/lib/db/migrate-synced-events.ts
```

Or add `DATABASE_URL` to your shell and run it directly. The `CREATE TABLE IF NOT EXISTS` is idempotent — safe to run multiple times.

## Next Phase Readiness

- syncedEvents table schema defined in Drizzle — Plan 02's preview endpoint can query `db.query.syncedEvents.findMany()` immediately
- Migration SQL ready to run against production Neon DB
- After next manual sync, syncedEvents rows will be populated and preview counts will be non-zero

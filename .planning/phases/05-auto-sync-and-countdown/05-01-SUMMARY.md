---
phase: 05-auto-sync-and-countdown
plan: 01
subsystem: api
tags: [drizzle, postgres, cron, vercel, nextjs]

# Dependency graph
requires:
  - phase: 04-event-type-grouping
    provides: sync pipeline with per-type sub-calendars that cron runner calls

provides:
  - syncLog DB table with userId unique constraint and upsert pattern
  - runSyncForUser extracted function (no progress callbacks) in src/lib/syncRunner.ts
  - upsertSyncLog function for recording sync outcomes to DB
  - /api/cron/sync route with CRON_SECRET auth and per-user error isolation
  - /api/sync/last endpoint returning DB-backed lastSyncedAt, lastSyncStatus, lastSyncError
  - vercel.json cron schedule at 06:00 UTC daily

affects:
  - 05-02 (CountdownPanel reads /api/sync/last)
  - 06 (DedupePanel may reference syncLog)
  - 07 (syncConflicts table depends on syncLog existing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cron routes use CRON_SECRET bearer auth, never getSession (no browser cookie in cron context)
    - Per-user error isolation in cron loops via independent try/catch per user
    - syncLog upsert pattern (one row per user, onConflictDoUpdate) for idempotent sync recording
    - runSyncForUser passes no-op callbacks to syncCanvasEvents and mirrorSchoolCalendars (cron has no progress UI)

key-files:
  created:
    - src/lib/syncRunner.ts
    - src/app/api/cron/sync/route.ts
    - src/app/api/sync/last/route.ts
    - src/app/api/cron/sync/__tests__/cronSync.test.ts
    - src/app/api/sync/last/__tests__/syncLast.test.ts
  modified:
    - src/lib/db/schema.ts
    - src/app/api/sync/route.ts
    - vercel.json

key-decisions:
  - "syncLog upsert uses onConflictDoUpdate on userId (unique) — one row per user, idempotent cron runs"
  - "Cron route does NOT call getSession() — cron has no browser cookie; CRON_SECRET header auth only"
  - "runSyncForUser in syncRunner.ts is a simplified version without progress tracking for cron use; manual sync route keeps its own runSyncJob with progress callbacks"
  - "Manual sync route also writes to syncLog on completion/error via upsertSyncLog — single read path for /api/sync/last"

patterns-established:
  - "Cron auth: Bearer ${process.env.CRON_SECRET} header check, 401 on mismatch"
  - "Per-user loop: for...of with independent try/catch, push result regardless of success/error"
  - "syncLog upsert: db.insert().values().onConflictDoUpdate({ target: syncLog.userId, set: {...} })"

requirements-completed: [CRON-01, CRON-02, CRON-03]

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 5 Plan 01: Cron Infrastructure Summary

**Vercel cron route with CRON_SECRET auth, per-user error isolation, syncLog DB table with upsert pattern, and /api/sync/last endpoint backed by DB**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T02:45:00Z
- **Completed:** 2026-03-17T03:01:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- syncLog table added to schema with userId unique constraint enabling idempotent per-user sync recording
- Extracted runSyncForUser and upsertSyncLog into src/lib/syncRunner.ts; both cron and manual sync routes now write to syncLog
- Cron route at /api/cron/sync authenticates via CRON_SECRET bearer token, loops all users with canvasIcsUrl, wraps each in independent try/catch, and writes syncLog per user
- /api/sync/last endpoint returns DB-backed lastSyncedAt/lastSyncStatus/lastSyncError for authenticated user
- vercel.json updated with daily cron schedule at 06:00 UTC
- 12 new tests added (8 cron, 4 sync/last); full suite 153 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add syncLog table + extract runSyncForUser into shared module** - `0f753d4` (feat)
2. **Task 2: Cron route + sync-last endpoint + vercel.json + tests** - `6106767` (feat)

## Files Created/Modified

- `src/lib/db/schema.ts` - Added syncLog table (userId unique, lastSyncedAt, lastSyncStatus, lastSyncError)
- `src/lib/syncRunner.ts` - New: runSyncForUser (5-step pipeline, no-op callbacks) and upsertSyncLog (onConflictDoUpdate)
- `src/app/api/sync/route.ts` - Added import upsertSyncLog and calls on success/error paths of runSyncJob
- `src/app/api/cron/sync/route.ts` - New: CRON_SECRET bearer auth, user loop with try/catch isolation, maxDuration=300
- `src/app/api/sync/last/route.ts` - New: GET returning DB-backed sync status for authenticated user
- `src/app/api/cron/sync/__tests__/cronSync.test.ts` - New: 8 tests covering auth, iteration, isolation, upsertSyncLog
- `src/app/api/sync/last/__tests__/syncLast.test.ts` - New: 4 tests covering unauth, no-row, success, error
- `vercel.json` - Added crons array with /api/cron/sync at schedule "0 6 * * *"

## Decisions Made

- syncLog upsert uses `onConflictDoUpdate` on `userId` (unique constraint) — one row per user, idempotent across multiple cron runs
- Cron route does NOT call `getSession()` — cron context has no browser cookie; CRON_SECRET header auth only (documented in v1.1 Roadmap decisions)
- `runSyncForUser` in syncRunner.ts is a simplified version without progress tracking for cron use; manual sync route keeps its own `runSyncJob` with progress callbacks and in-memory syncJobs Map
- Manual sync route also writes to syncLog on completion/error — single read path for /api/sync/last regardless of whether sync was triggered manually or by cron

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**CRON_SECRET environment variable must be added to Vercel project settings** before the cron route will authenticate successfully. Add `CRON_SECRET` with a long random value to your Vercel environment variables.

## Next Phase Readiness

- syncLog table and /api/sync/last endpoint are ready for CountdownPanel (Plan 05-02) to consume
- Cron route is deployed via vercel.json but requires CRON_SECRET env var in Vercel dashboard
- Manual sync writes to syncLog so lastSyncedAt is populated even before cron runs

---
*Phase: 05-auto-sync-and-countdown*
*Completed: 2026-03-17*

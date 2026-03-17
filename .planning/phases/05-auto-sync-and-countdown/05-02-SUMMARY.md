---
phase: 05-auto-sync-and-countdown
plan: 02
subsystem: ui
tags: [react, nextjs, countdown, dashboard, timezone, client-component]

# Dependency graph
requires:
  - phase: 05-auto-sync-and-countdown (plan 01)
    provides: syncLog DB table, /api/sync/last endpoint returning DB-backed lastSyncedAt/lastSyncStatus

provides:
  - CountdownPanel component with timezone-safe getBucket logic (overdue/today/tomorrow/this_week/later)
  - SyncDashboard reads lastSyncedAt from /api/sync/last instead of localStorage
  - SyncDashboard shows sync error status when last sync failed
  - Upcoming deadlines grouped by proximity visible on dashboard without manual sync

affects:
  - 06 (DedupePanel added to SyncDashboard following same client-component pattern)
  - 07 (Conflict detection UI will use same dashboard layout patterns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Client-only timezone bucketing via 'use client' + mounted state gate (prevents hydration mismatch)
    - Flatten courses to flat events array with courseEnabled prop for CountdownPanel filtering
    - Single read path for sync status via /api/sync/last (DB-backed, not localStorage)

key-files:
  created:
    - src/components/CountdownPanel.tsx
    - src/components/__tests__/CountdownPanel.test.tsx
  modified:
    - src/components/SyncDashboard.tsx

key-decisions:
  - "CountdownPanel uses 'use client' + mounted state gate to suppress server render entirely — avoids React hydration mismatch for non-UTC users"
  - "countdownEvents useMemo flattens courses into flat CountdownEvent array with courseName and courseEnabled — single prop interface to CountdownPanel"
  - "Only Overdue/Today/Tomorrow/This Week buckets displayed — 'later' excluded as non-actionable"

patterns-established:
  - "Client-only component pattern: 'use client' + useState(false) mounted gate + useEffect(() => setMounted(true)) + return null if !mounted"
  - "getBucket: normalize both dates to local calendar day (year/month/date constructor), compute diffDays = Math.round(diff/86400000)"

requirements-completed: [CRON-02, COUNTDOWN-01]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 5 Plan 02: Dashboard DB Sync Status and CountdownPanel Summary

**Client-only CountdownPanel with timezone-safe getBucket bucketing and SyncDashboard migrated from localStorage to DB-backed /api/sync/last**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T03:03:43Z
- **Completed:** 2026-03-17T03:07:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- CountdownPanel component created with 'use client' directive and mounted gate for hydration safety; renders Overdue/Due Today/Due Tomorrow/Due This Week sections
- getBucket function exported and unit-tested across all 4 required buckets (8 tests, all passing)
- SyncDashboard migrated from localStorage to /api/sync/last fetch on mount — cron-run timestamps now visible without manual sync
- SyncDashboard shows "(failed)" label when lastSyncStatus is 'error'
- Full test suite: 161 tests passing (up from 153 in Plan 01, +8 new getBucket tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: CountdownPanel component with getBucket logic and tests** - `376d1c7` (feat)
2. **Task 2: Wire SyncDashboard to DB-backed sync status and CountdownPanel** - `425f581` (feat)

## Files Created/Modified

- `src/components/CountdownPanel.tsx` - 'use client' deadline bucketing component; exports getBucket; handles empty state; filters excluded events and disabled courses
- `src/components/__tests__/CountdownPanel.test.tsx` - 8 unit tests for getBucket covering all bucket boundaries with deterministic fake timers
- `src/components/SyncDashboard.tsx` - Replaced localStorage useEffect with /api/sync/last fetch; added lastSyncStatus state; added countdownEvents useMemo; renders CountdownPanel after header

## Decisions Made

- CountdownPanel uses 'use client' + mounted state gate to suppress server render entirely — avoids React hydration mismatch for non-UTC users (pre-locked decision in STATE.md)
- countdownEvents useMemo flattens courses into a flat CountdownEvent array with courseName and courseEnabled — single prop interface to CountdownPanel rather than passing courses directly
- Only Overdue/Today/Tomorrow/This Week buckets displayed in the panel — 'later' bucket computed internally but excluded from render as non-actionable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CountdownPanel and DB-backed sync status are ready; Phase 5 requirements CRON-02 and COUNTDOWN-01 are complete
- Phase 6 (DedupePanel) can follow the same client-component pattern established by CountdownPanel

---
*Phase: 05-auto-sync-and-countdown*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: src/components/CountdownPanel.tsx
- FOUND: src/components/__tests__/CountdownPanel.test.tsx
- FOUND: .planning/phases/05-auto-sync-and-countdown/05-02-SUMMARY.md
- FOUND commit: 376d1c7 (Task 1)
- FOUND commit: 425f581 (Task 2)
- Test suite: 18 suites, 161 tests, all passing

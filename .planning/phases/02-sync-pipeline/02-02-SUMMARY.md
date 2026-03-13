---
phase: 02-sync-pipeline
plan: "02"
subsystem: sync
tags: [googleapis, google-calendar, drizzle, typescript, bulk-dedup, sub-calendars, mirror]

requires:
  - phase: 01-auth-foundation
    provides: getFreshAccessToken for session-based token retrieval
  - phase: 02-sync-pipeline-plan-01
    provides: courseSelections and schoolCalendarSelections DB schema tables

provides:
  - Refactored gcalSync.ts with bulk dedup (single events.list per sub-calendar) and per-course sub-calendar targeting
  - gcalSubcalendars.ts helper: ensureSubCalendar and ensureMirrorSubCalendar with DB caching
  - schoolMirror.ts service: listSchoolCalendars (with system calendar filtering) and mirrorSchoolCalendars
  - Full test coverage: 33 tests passing across gcalSync and schoolMirror

affects:
  - 02-sync-pipeline (API routes using syncCanvasEvents, mirrorSchoolCalendars)
  - 02-sync-pipeline (dashboard UI wiring progress callbacks)
  - future-phases (sub-calendar pattern established for course and school calendars)

tech-stack:
  added: []
  patterns:
    - "Bulk dedup: single events.list per sub-calendar with privateExtendedProperty filter, local Map diff, then insert/update only changed events"
    - "Sub-calendar caching: DB-first check before calendar.calendars.insert; calendarId stored to prevent duplicates on each sync"
    - "Color at sub-calendar level only: colorId set on calendars.insert, NOT on individual events (avoids event-level color palette confusion)"
    - "Session-based token access: getFreshAccessToken(userId, 'personal'|'school') inside service functions — no raw tokens in function signatures"
    - "Separate Google Calendar clients per account: personal and school clients created with their respective OAuth2 credentials"

key-files:
  created:
    - src/services/gcalSubcalendars.ts
    - src/services/schoolMirror.ts
    - src/services/gcalSync.test.ts
    - src/services/schoolMirror.test.ts
  modified:
    - src/services/gcalSync.ts

key-decisions:
  - "Bulk dedup replaces CONCURRENCY=3 per-event pattern: single events.list per sub-calendar reduces N API calls to 1 per course"
  - "ensureSubCalendar checks DB before API call to prevent sub-calendar duplication on each sync (Pitfall 1 from RESEARCH.md)"
  - "colorId set at sub-calendar level only (not per-event) — allows users to override per-event colors in Google Calendar UI"
  - "School event titles copied verbatim — no AI cleanup applied per locked decision in CONTEXT.md"
  - "listSchoolCalendars defaults new (unseen) calendars to selected=true (auto-include new school calendars)"
  - "mirrorSchoolCalendars uses 30-day past / 90-day ahead time window for school event fetching"
  - "schoolEventId in extendedProperties.private used for school event dedup (parallel to canvasCanvasUid for Canvas events)"

patterns-established:
  - "Pattern: DB-first sub-calendar lookup before calendar.calendars.insert — prevents duplicate calendars"
  - "Pattern: Bulk fetch then local diff — one events.list per calendar, not one per event"
  - "Pattern: extendedProperties.private for source-specific dedup keys (canvasCanvasUid, schoolEventId)"
  - "Pattern: SyncSummary/MirrorSummary return shape with inserted/updated/skipped/failed/errors"
  - "Pattern: getFreshAccessToken called inside service functions, not passed as parameter"

requirements-completed: [CANVAS-04, CANVAS-05, MIRROR-01, MIRROR-02]

duration: 45min
completed: 2026-03-12
---

# Phase 02 Plan 02: Bulk Dedup Sync Engine and School Calendar Mirror Summary

**Bulk dedup gcalSync with per-course Google Calendar sub-calendars (1 events.list per course vs N), plus school account one-way mirror service with system calendar filtering and schoolEventId dedup**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-12T21:00:00Z
- **Completed:** 2026-03-12T21:45:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5

## Accomplishments

- Replaced the CONCURRENCY=3 per-event dedup bottleneck with a single bulk events.list per sub-calendar — 80 Canvas events now require 1 API call instead of 80 for dedup
- Created gcalSubcalendars.ts helper that checks DB before creating sub-calendars, preventing calendar duplication on repeat syncs
- Built schoolMirror service that lists school calendars (filtered), mirrors selected ones one-way to personal account, preserves titles as-is, and uses schoolEventId for dedup
- 33 tests pass across both services (18 gcalSync, 15 schoolMirror)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: gcalSync failing tests** - `cd1371e` (test)
2. **Task 1 GREEN: gcalSync bulk dedup + gcalSubcalendars** - `f54128e` (feat)
3. **Task 2 RED: schoolMirror failing tests** - `5bf58cc` (test)
4. **Task 2 GREEN: schoolMirror service** - `24c8927` (feat)

_Note: TDD tasks have separate RED and GREEN commits_

## Files Created/Modified

- `src/services/gcalSync.ts` - Completely rewritten: bulk dedup, syncCanvasEvents() signature, SyncProgress/SyncSummary types, no raw accessToken param
- `src/services/gcalSubcalendars.ts` - New: ensureSubCalendar and ensureMirrorSubCalendar with DB-first caching pattern
- `src/services/schoolMirror.ts` - New: listSchoolCalendars with system calendar filtering, mirrorSchoolCalendars with bulk dedup
- `src/services/gcalSync.test.ts` - New: 18 tests for bulk dedup, sub-calendar creation, SyncSummary counts, onProgress callback
- `src/services/schoolMirror.test.ts` - New: 15 tests for calendar listing/filtering, mirroring, dedup, title preservation

## Decisions Made

- Used a DB-first pattern in ensureSubCalendar: always query DB before calling calendar.calendars.insert. This prevents the "duplicate sub-calendar" problem (Pitfall 1 from RESEARCH.md) where each sync would create a new "Canvas - Course Name" entry in the user's Google Calendar sidebar.
- Color is set only at sub-calendar creation time (calendars.insert), not on individual events. This preserves the ability for users to override colors per-event in Google Calendar, and avoids the calendar vs. event colorId palette confusion (Pitfall 3 from RESEARCH.md).
- School event titles are copied verbatim. No AI title cleanup is applied to school calendar events per the locked decision in CONTEXT.md — only Canvas events get AI title formatting.
- New (unseen) school calendars default to selected=true in listSchoolCalendars. This matches the Canvas behavior where new courses are auto-included unless explicitly disabled.

## Deviations from Plan

None — plan executed exactly as written. The googleapis mock approach in tests was restructured to use token-based client dispatch (token → client map) rather than a counter-based approach, which proved more reliable across test suites.

## Issues Encountered

- Jest was very slow (30+ seconds per test file) due to WSL on Windows NTFS — this is a known issue documented in STATE.md. Tests were run with `node node_modules/jest/bin/jest.js --maxWorkers=1` to avoid timeout issues. All tests pass.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- syncCanvasEvents() is ready to be called from the /api/sync route (Plan 03 or future plan)
- mirrorSchoolCalendars() is ready to be called from the /api/sync route
- Both functions accept optional onProgress callbacks for streaming progress bar support
- schoolMirror depends on schoolCalendarSelections DB rows being seeded (via listSchoolCalendars + user selection UI)
- Sub-calendar IDs will be stored in DB on first sync call — no manual setup needed

---
*Phase: 02-sync-pipeline*
*Completed: 2026-03-12*

## Self-Check: PASSED

All files present: gcalSync.ts, gcalSubcalendars.ts, schoolMirror.ts, gcalSync.test.ts, schoolMirror.test.ts, 02-02-SUMMARY.md
All commits verified: cd1371e, f54128e, 5bf58cc, 24c8927

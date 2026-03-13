---
phase: 02-sync-pipeline
plan: "03"
subsystem: api
tags: [nextjs, route-handlers, drizzle, canvas, google-calendar, session-auth]

# Dependency graph
requires:
  - phase: 02-sync-pipeline/02-01
    provides: syncFilter, colorAssignment, titleCleanup services + DB schema (courseSelections, eventOverrides, schoolCalendarSelections)
  - phase: 02-sync-pipeline/02-02
    provides: gcalSync, schoolMirror services with bulk dedup sync engine
  - phase: 01-auth-foundation
    provides: getSession(), getFreshAccessToken(), user table with canvasIcsUrl

provides:
  - GET /api/parse-ics — session-auth, reads stored canvasIcsUrl, returns courses with cleaned titles and selection state
  - GET/PUT /api/user-selections — CRUD for course enable/disable, colorId, and per-event overrides
  - GET/PUT /api/school-calendars — lists filtered school calendars, toggles selection
  - POST /api/sync — starts background sync job (Canvas + school mirror), returns jobId with 202
  - GET /api/sync/status?jobId=X — polls progress and summaries for running/completed sync job

affects: [03-dashboard-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget background job via void promise with in-memory Map for polling
    - Session auth guard on all routes (401 without valid session)
    - Drizzle onConflictDoUpdate for batch upsert of selections
    - In-memory syncJobs Map with 5-minute TTL pruning for job state

key-files:
  created:
    - src/app/api/user-selections/route.ts
    - src/app/api/school-calendars/route.ts
    - src/app/api/sync/route.ts
    - src/app/api/sync/status/route.ts
  modified:
    - src/app/api/parse-ics/route.ts

key-decisions:
  - "parse-ics switched from POST with feedUrl body to GET with session auth — no raw URLs in request bodies"
  - "Sync job uses fire-and-forget void promise (not waitUntil) — simpler and sufficient for manual sync button use case"
  - "syncJobs Map cleaned on terminal state returned to client + 5-minute TTL background pruning"
  - "colorId validated as integer 1-11 in user-selections PUT to enforce Google Calendar palette constraints"

patterns-established:
  - "Route auth guard: getSession() → 401 pattern consistent across all 5 routes"
  - "Background job pattern: POST returns 202 + jobId, GET polls status by jobId"

requirements-completed: [CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, MIRROR-01, MIRROR-02, SYNC-01]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 02 Plan 03: API Routes Summary

**5 Next.js API routes wiring Canvas parsing, selection CRUD, and school calendar listing to a unified background sync endpoint with in-memory polling**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-13T00:19:55Z
- **Completed:** 2026-03-13T00:27:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Refactored `parse-ics` from POST with raw feedUrl to GET using session auth and DB-stored canvasIcsUrl
- Created `user-selections` GET/PUT for batch CRUD on course enable/disable, colorId, and event overrides
- Created `school-calendars` GET/PUT with linked status detection and calendar toggle
- Created unified `sync` POST that orchestrates Canvas sync + school mirror as a background job
- Created `sync/status` GET polling endpoint returning live progress and summaries

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor parse-ics and add user-selections + school-calendars routes** - `b2b8362` (feat)
2. **Task 2: Create unified sync endpoint with polling-based progress** - `b1225f5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/api/parse-ics/route.ts` - Refactored to GET, session auth, stored canvasIcsUrl, returns courses with cleanedTitle and excluded state
- `src/app/api/user-selections/route.ts` - GET/PUT for courseSelections and eventOverrides with colorId validation (1-11)
- `src/app/api/school-calendars/route.ts` - GET lists filtered school calendars with `linked` field, PUT toggles selection
- `src/app/api/sync/route.ts` - POST starts background sync job via fire-and-forget void promise, returns jobId with 202
- `src/app/api/sync/status/route.ts` - GET polls syncJobs Map by jobId, cleans up on terminal state return

## Decisions Made

- **parse-ics switched to GET with session auth:** No raw URLs in request bodies, consistent with zero-raw-token policy. canvasIcsUrl fetched from DB via session userId.
- **Fire-and-forget void promise for background sync:** `waitUntil` from next/server unavailable in this project's setup. Simple void promise is sufficient — sync catches its own errors and stores them in job state.
- **In-memory syncJobs Map:** Acceptable for manual sync button use case. Progress lost on server restart is fine since users initiate sync manually and stay on page during the 5-15 second window.
- **colorId validation in user-selections PUT:** Validates integer range 1-11 before upsert to prevent invalid color IDs from reaching Google Calendar API.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 routes ready for consumption by Plan 04 (dashboard UI)
- Dashboard can call GET /api/parse-ics to populate course list with selection state
- Dashboard can call POST /api/sync and poll GET /api/sync/status?jobId=X for progress display
- School calendar selection UI can use GET/PUT /api/school-calendars

---
*Phase: 02-sync-pipeline*
*Completed: 2026-03-13*

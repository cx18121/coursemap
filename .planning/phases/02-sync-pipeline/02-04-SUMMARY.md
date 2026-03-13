---
phase: 02-sync-pipeline
plan: "04"
subsystem: ui
tags: [nextjs, react, tailwindcss, dashboard, accordion, color-picker, google-calendar]

# Dependency graph
requires:
  - phase: 02-sync-pipeline/02-03
    provides: GET /api/parse-ics, GET/PUT /api/user-selections, GET/PUT /api/school-calendars, POST /api/sync, GET /api/sync/status

provides:
  - Complete sync dashboard UI consuming all Plan 03 API routes
  - CourseAccordion with checkbox, color dot, expandable events list
  - EventRow with checkbox, cleaned title, formatted date, description preview
  - ColorPicker dropdown with 11 Google Calendar colors
  - SchoolCalendarList checkbox list of school calendars
  - SyncButton with animated progress bar during sync
  - SyncSummary with created/updated/skipped/failed counts, persists until next change

affects: [03-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Component passes minimal props (userName, hasCanvasUrl, hasSchoolAccount) to client root
    - Optimistic UI updates — state updated before API call, no rollback on error for simplicity
    - Polling pattern — setInterval every 500ms for sync job progress, cleared on terminal state
    - SyncSummary persists in state, cleared on any course/event/color change

key-files:
  created:
    - src/components/SyncDashboard.tsx
    - src/components/CourseAccordion.tsx
    - src/components/EventRow.tsx
    - src/components/ColorPicker.tsx
    - src/components/SchoolCalendarList.tsx
    - src/components/SyncButton.tsx
    - src/components/SyncSummary.tsx
  modified:
    - src/app/dashboard/page.tsx
    - src/app/api/sync-gcal/route.ts
    - src/services/gcalSubcalendars.ts

key-decisions:
  - "Server Component fetches school OAuth token to determine hasSchoolAccount — no client-side check"
  - "Optimistic UI for all toggles — no rollback; server errors logged to console only"
  - "SyncSummary dismissed on any change (course toggle, event toggle, color change) per CONTEXT.md locked decision"
  - "ColorPicker uses click-outside handler via useRef and document mousedown listener"
  - "calendarList.patch used for colorId (not calendar.insert requestBody) — colorId is a calendarList property"
  - "Legacy sync-gcal route stubbed with 410 Gone — superseded by /api/sync, CalendarSetup.tsx is prototype"

patterns-established:
  - "Polling pattern: setInterval stored in useRef, cleared in useEffect cleanup + terminal state handler"
  - "Glassmorphic card: bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]"
  - "Server Component → Client Component prop passing: minimal data from server, client fetches rest on mount"

requirements-completed: [CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-05, MIRROR-02, SYNC-01]

# Metrics
duration: 34min
completed: 2026-03-13
---

# Phase 02 Plan 04: Dashboard UI Summary

**Complete sync dashboard with Canvas course accordion (checkboxes, 11-color picker), school calendar list, sticky Sync Now button with animated progress bar, and post-sync summary panel**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-03-13T00:30:22Z
- **Completed:** 2026-03-13T01:04:56Z
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint)
- **Files modified:** 10

## Accomplishments

- Replaced Phase 1 placeholder dashboard with full sync UI: 7 new components, 1 updated server page
- SyncDashboard client component orchestrates all state (courses, school calendars, sync status, polling)
- CourseAccordion with smooth expand/collapse, course-level checkbox toggling all events, ColorPicker dropdown
- Sticky SyncButton with gradient progress bar showing processed/total events during sync
- SyncSummary panel with per-job inserted/updated/skipped/failed counts, collapsible error list, persists until change

## Task Commits

Each task was committed atomically:

1. **Task 1: Build dashboard page with SyncDashboard, CourseAccordion, and SchoolCalendarList** - `c0c3eba` (feat)
2. **Task 2: Build SyncButton with progress bar and SyncSummary panel** - `54bfa20` (feat)

**Plan metadata:** (docs commit follows after checkpoint)

## Files Created/Modified

- `src/app/dashboard/page.tsx` - Server Component: auth check, hasCanvasUrl, hasSchoolAccount detection, renders SyncDashboard
- `src/components/SyncDashboard.tsx` - Client root: mount fetches, course/event/color/calendar handlers, sync polling (500ms), summary state
- `src/components/CourseAccordion.tsx` - Glassmorphic card with checkbox, color dot, event count badge, expand/collapse events
- `src/components/EventRow.tsx` - Individual event: checkbox, cleanedTitle, formatted date, 80-char description truncation
- `src/components/ColorPicker.tsx` - 11-color Google Calendar palette dropdown with click-outside close; exports GOOGLE_CALENDAR_COLORS map
- `src/components/SchoolCalendarList.tsx` - Checkbox list of school calendars, "No calendars found" for empty/linked state
- `src/components/SyncButton.tsx` - Fixed bottom glass bar: idle/running/error states, animated indigo-purple gradient progress fill
- `src/components/SyncSummary.tsx` - Post-sync summary card: per-job counts, collapsible errors, slide-in animation, dismiss button
- `src/app/api/sync-gcal/route.ts` - Deprecated legacy route stubbed with 410 Gone
- `src/services/gcalSubcalendars.ts` - Fixed: colorId set via calendarList.patch (not insert requestBody), both insert calls use type assertion for data access

## Decisions Made

- **Server Component detects school account:** Dashboard page queries oauthTokens for role='school' to determine hasSchoolAccount — boolean prop avoids any client-side token exposure.
- **Optimistic UI:** State updated immediately on toggle/color change before API call resolves. Console.error on failure only — acceptable for a single-user sync tool with no concurrent editors.
- **Summary cleared on any change:** Per CONTEXT.md locked decision. Implemented by calling clearSummary() at the top of every handler.
- **ColorPicker as separate component:** Accepts onClose prop + uses click-outside handler; parent manages open/closed state with showColorPicker useState.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed legacy sync-gcal route with broken import**
- **Found during:** Task 1 verification (build)
- **Issue:** `src/app/api/sync-gcal/route.ts` imported `syncToGoogleCalendar` which no longer exists (renamed to `syncCanvasEvents` with different signature). Pre-existing from Phase 1 prototype.
- **Fix:** Stubbed route with 410 Gone response — route is superseded by /api/sync (Plan 03)
- **Files modified:** src/app/api/sync-gcal/route.ts
- **Verification:** Build passes after change
- **Committed in:** c0c3eba (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed gcalSubcalendars.ts TypeScript type error**
- **Found during:** Task 1 verification (build, second attempt)
- **Issue:** `calendar.calendars.insert()` returns a union type; TypeScript couldn't destructure `{ data }` from it. Also, `colorId` was incorrectly placed in the insert requestBody (not a valid Schema$Calendar field — it belongs in calendarList.patch).
- **Fix:** Used type assertion for data access; moved colorId to a calendarList.patch call after insert
- **Files modified:** src/services/gcalSubcalendars.ts
- **Verification:** Build passes after change
- **Committed in:** c0c3eba (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking pre-existing build errors)
**Impact on plan:** Both were pre-existing failures that blocked the build. No scope creep.

## Issues Encountered

Build had 2 pre-existing TypeScript errors from Phase 1/2 prototype code that blocked verification. Both were fixed inline as Rule 3 deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 dashboard components ready; human verification checkpoint (Task 3) pending
- After human verification confirms end-to-end flow, Phase 2 is complete
- Phase 3 (deployment/polish) can proceed once human checkpoint is approved

## Self-Check: PASSED

- FOUND: src/components/SyncDashboard.tsx
- FOUND: src/components/CourseAccordion.tsx
- FOUND: src/components/EventRow.tsx
- FOUND: src/components/ColorPicker.tsx
- FOUND: src/components/SchoolCalendarList.tsx
- FOUND: src/components/SyncButton.tsx
- FOUND: src/components/SyncSummary.tsx
- FOUND: src/app/dashboard/page.tsx (updated)
- FOUND: commit c0c3eba
- FOUND: commit 54bfa20

---
*Phase: 02-sync-pipeline*
*Completed: 2026-03-13*

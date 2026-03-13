---
phase: 02-sync-pipeline
verified: 2026-03-12T22:00:00Z
status: gaps_found
score: 12/14 must-haves verified
re_verification: false
gaps:
  - truth: "Selected Canvas events push to per-course sub-calendars on the personal Google Calendar"
    status: partial
    reason: "gcalSync.ts implementation is correct and wired, but 15/18 gcalSync tests fail because the test mock for googleapis does not include calendarList.patch. The fix in gcalSubcalendars.ts (which correctly moves colorId to calendarList.patch) was not reflected in the test mock. Production behavior is correct; tests are broken."
    artifacts:
      - path: "src/services/gcalSync.test.ts"
        issue: "googleapis mock at line 19-29 provides calendars.insert and events.* but not calendarList.patch. gcalSubcalendars.ts calls calendar.calendarList.patch() after calendars.insert; mock returns undefined for calendarList, causing TypeError in 15/18 tests."
    missing:
      - "Add calendarList: { patch: mockCalendarListPatch } to the googleapis mock in gcalSync.test.ts"
      - "Define mockCalendarListPatch = jest.fn().mockResolvedValue({}) before jest.mock block"
  - truth: "Dedup uses bulk events.list instead of per-event lookup"
    status: partial
    reason: "Implementation correctly uses bulk events.list (verified in code), but the test covering this behavior ('uses a single events.list call per course') fails due to the same calendarList.patch mock gap, preventing test confirmation."
    artifacts:
      - path: "src/services/gcalSync.test.ts"
        issue: "Test 'uses a single events.list call per course (bulk fetch)' fails with the same TypeError before reaching the events.list assertion."
    missing:
      - "Same fix as above: add calendarList.patch to the googleapis mock"
human_verification:
  - test: "End-to-end sync to Google Calendar"
    expected: "Click Sync Now on the dashboard; Canvas events appear in per-course sub-calendars (e.g., 'Canvas - Math 101') in personal Google Calendar with correct colors; school calendar events appear in 'School - CalendarName' sub-calendars"
    why_human: "Cannot verify actual Google Calendar API calls or sub-calendar creation programmatically without live credentials"
  - test: "Summary persistence behavior"
    expected: "After sync completes, SyncSummary card stays visible; when user toggles any course checkbox or color, the summary disappears immediately"
    why_human: "DOM/React state behavior requires browser interaction to verify"
  - test: "Color picker z-index and portal positioning"
    expected: "Clicking a color dot on any course accordion opens the 11-color picker above all other cards; picker dismisses on click-outside"
    why_human: "CSS stacking context / portal rendering requires browser visual verification (this was a known bug fixed in Plan 04 but should be confirmed)"
---

# Phase 2: Sync Pipeline Verification Report

**Phase Goal:** Build the complete Canvas-to-Google Calendar sync pipeline — ICS parsing, course/event selection, color assignment, title cleanup, bulk dedup sync with per-course sub-calendars, school calendar mirroring, and dashboard UI.
**Verified:** 2026-03-12T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Course selections persist in DB per user across sessions | VERIFIED | courseSelections table in schema.ts with userId+courseName unique index; user-selections PUT route upserts via drizzle onConflictDoUpdate |
| 2 | Event-level overrides allow excluding individual events while course stays enabled | VERIFIED | eventOverrides table with enabled=false default; filterEventsForSync applies both course and event filters; parse-ics returns excluded boolean per event |
| 3 | Each course gets a distinct color from Google's 11-color palette | VERIFIED | GOOGLE_CALENDAR_COLORS maps "1"-"11" in colorAssignment.ts; assignCourseColors round-robins unused IDs; colorId validated 1-11 in user-selections PUT |
| 4 | AI-cleaned titles are cached so repeat syncs don't re-call the API | VERIFIED | eventTitleCache table; getCleanedTitle checks DB first; cleanTitlesBatch uses inArray for bulk cache lookup; onConflictDoNothing prevents race conditions |
| 5 | New Canvas events are auto-included unless their course is disabled | VERIFIED | filterEventsForSync: no DB row for course defaults to enabled; no DB row for event defaults to enabled |
| 6 | Selected Canvas events push to per-course sub-calendars on the personal Google Calendar | PARTIAL | syncCanvasEvents implementation wired correctly (ensureSubCalendar -> bulk events.list -> diff -> insert/update); gcalSubcalendars.ts stores calendarId in DB; BUT 15/18 gcalSync tests fail due to missing calendarList.patch in test mock |
| 7 | Dedup uses bulk events.list instead of per-event lookup | PARTIAL | Code confirmed: single events.list per sub-calendar with privateExtendedProperty filter at line 131-136 of gcalSync.ts; BUT bulk dedup test fails due to same calendarList.patch mock gap |
| 8 | Sub-calendars are created once and their calendarId is stored in DB | VERIFIED | ensureSubCalendar checks DB first (findFirst), creates only if gcalCalendarId is null, stores via db.update; schoolMirror uses ensureMirrorSubCalendar with same pattern |
| 9 | School Google Calendar events mirror one-way to personal account | VERIFIED | mirrorSchoolCalendars fetches from school account, copies to personal mirror sub-calendars; titles copied verbatim; schoolMirror tests: 15/15 pass |
| 10 | Only user-selected school calendars are mirrored | VERIFIED | mirrorSchoolCalendars queries schoolCalendarSelections where enabled=true; listSchoolCalendars filters system calendars (freeBusyReader, #contacts, #holiday, #weather) |
| 11 | parse-ics route uses stored canvasIcsUrl from DB instead of request body | VERIFIED | parse-ics/route.ts is GET, queries users.canvasIcsUrl via session userId; no feedUrl in request; 401 without session |
| 12 | User selections (course enable/disable, event overrides, colors) are read/written via API | VERIFIED | user-selections GET/PUT wired to courseSelections + eventOverrides tables; colorId validated 1-11 in PUT |
| 13 | Sync endpoint orchestrates Canvas sync + school mirror, returns progress via polling | VERIFIED | POST /api/sync fires runSyncJob void promise; returns 202 + jobId; GET /api/sync/status polls syncJobs Map; both services called in sequence |
| 14 | Dashboard UI shows courses in accordion with checkboxes, color picker, school calendars, and sync button | VERIFIED | All 7 components exist and are wired; SyncDashboard fetches /api/parse-ics and /api/school-calendars on mount; handlers PUT to /api/user-selections; SyncButton polls /api/sync/status |

**Score:** 12/14 truths verified (2 partial due to test failures in gcalSync.test.ts)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | courseSelections, eventOverrides, eventTitleCache, schoolCalendarSelections tables | VERIFIED | All 4 tables present with correct columns, indexes, foreign keys |
| `src/services/syncFilter.ts` | filterEventsForSync, ensureCourseSelections exports | VERIFIED | Both functions exported, 103 lines, wired to courseSelections + eventOverrides |
| `src/services/syncFilter.test.ts` | Tests for selection filtering | VERIFIED | 11 tests, all pass |
| `src/services/colorAssignment.ts` | assignCourseColors, GOOGLE_CALENDAR_COLORS exports | VERIFIED | Both exported, 11-color palette, round-robin logic |
| `src/services/colorAssignment.test.ts` | Tests for color rotation | VERIFIED | 10 tests, all pass |
| `src/services/titleCleanup.ts` | getCleanedTitle, cleanTitlesBatch exports | VERIFIED | Both exported, AI path + regex fallback + cache |
| `src/services/titleCleanup.test.ts` | Tests with mocked Anthropic SDK | VERIFIED | 11 tests, all pass |
| `src/services/gcalSync.ts` | syncCanvasEvents, SyncProgress, SyncSummary exports | VERIFIED | All exported, bulk dedup implemented, no raw accessToken in signature |
| `src/services/gcalSync.test.ts` | Tests for bulk dedup and sub-calendar sync | STUB | 15/18 tests fail — TypeError: Cannot read properties of undefined (reading 'patch'); googleapis mock missing calendarList.patch |
| `src/services/gcalSubcalendars.ts` | ensureSubCalendar export | VERIFIED | Exported, DB-first check, calendarList.patch for color setting |
| `src/services/schoolMirror.ts` | listSchoolCalendars, mirrorSchoolCalendars exports | VERIFIED | Both exported, system calendar filter, bulk dedup, verbatim titles |
| `src/services/schoolMirror.test.ts` | Tests for school calendar mirroring | VERIFIED | 15/15 tests pass (confirmed) |
| `src/app/api/parse-ics/route.ts` | GET handler, session auth, stored canvasIcsUrl | VERIFIED | GET only, session auth, DB lookup, cleanTitlesBatch, excluded state |
| `src/app/api/user-selections/route.ts` | GET and PUT handlers | VERIFIED | Both handlers, colorId validation 1-11, drizzle upsert |
| `src/app/api/school-calendars/route.ts` | GET and PUT handlers | VERIFIED | GET calls listSchoolCalendars, PUT upserts schoolCalendarSelections |
| `src/app/api/sync/route.ts` | POST handler, background job, 202 response | VERIFIED | Fire-and-forget void promise, jobId with 202, full pipeline wired |
| `src/app/api/sync/status/route.ts` | GET handler, polling by jobId | VERIFIED | Reads syncJobs Map, cleans up on terminal state |
| `src/app/dashboard/page.tsx` | Server Component with hasCanvasUrl, hasSchoolAccount props | VERIFIED | Server Component, session check, oauthTokens role='school' query |
| `src/components/SyncDashboard.tsx` | Client root, API calls, polling | VERIFIED | 363 lines, fetch /api/parse-ics + /api/school-calendars on mount, 500ms poll |
| `src/components/CourseAccordion.tsx` | Accordion with checkbox, color dot, events | VERIFIED | Glassmorphic card, expand/collapse, color dot button, EventRow list |
| `src/components/EventRow.tsx` | Event row with checkbox, cleanedTitle, date | VERIFIED | Displays cleanedTitle (not summary), formatDate, 80-char description truncation |
| `src/components/ColorPicker.tsx` | 11-color dropdown with createPortal | VERIFIED | createPortal to document.body, position:fixed z-index:9999, click-outside handler |
| `src/components/SchoolCalendarList.tsx` | Checkbox list of school calendars | VERIFIED | Checkbox per calendar, "No calendars found" for empty state |
| `src/components/SyncButton.tsx` | Sticky progress bar during sync | VERIFIED | fixed bottom-0, progress bar with gradient, idle/running/error states |
| `src/components/SyncSummary.tsx` | Post-sync counts panel | VERIFIED | canvas+mirror summaries, collapsible errors, dismiss button |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/syncFilter.ts` | `src/lib/db/schema.ts` | drizzle query on courseSelections + eventOverrides | WIRED | Lines 25-40 query both tables via db.query |
| `src/services/colorAssignment.ts` | `src/lib/db/schema.ts` | drizzle upsert on courseSelections.colorId | WIRED | Lines 94-102 insert+onConflictDoUpdate |
| `src/services/titleCleanup.ts` | `src/lib/db/schema.ts` | drizzle query/insert on eventTitleCache | WIRED | Lines 33-36 findFirst; lines 64-68 insert+onConflictDoNothing |
| `src/services/gcalSync.ts` | `src/services/gcalSubcalendars.ts` | ensureSubCalendar call before inserting events | WIRED | Line 128: `const subCalId = await ensureSubCalendar(...)` |
| `src/services/gcalSync.ts` | googleapis calendar.events.list | bulk fetch with privateExtendedProperty filter | WIRED | Lines 131-136: `calendar.events.list({ privateExtendedProperty: ['canvasSourceCalendarId=canvas'] })` |
| `src/services/schoolMirror.ts` | googleapis calendar.calendarList.list | list school account calendars | WIRED | Line 70: `schoolCalendar.calendarList.list({ minAccessRole: 'reader' })` |
| `src/app/api/parse-ics/route.ts` | `src/services/icalParser.ts` | parseCanvasFeed(user.canvasIcsUrl) | WIRED | Line 33: `const groupedEvents = await parseCanvasFeed(user.canvasIcsUrl)` |
| `src/app/api/parse-ics/route.ts` | `src/services/titleCleanup.ts` | cleanTitlesBatch for AI title cleanup | WIRED | Line 46: `const cleanedTitlesMap = await cleanTitlesBatch(allTitles)` |
| `src/app/api/sync/route.ts` | `src/services/gcalSync.ts` | syncCanvasEvents(userId, filteredEvents, colorMap) | WIRED | Lines 55-70: `await syncCanvasEvents(userId, filteredEvents, colorMap, ...)` |
| `src/app/api/sync/route.ts` | `src/services/schoolMirror.ts` | mirrorSchoolCalendars(userId) | WIRED | Lines 73-87: `await mirrorSchoolCalendars(userId, ...)` |
| `src/app/api/sync/route.ts` | `src/services/syncFilter.ts` | filterEventsForSync before sync | WIRED | Line 49: `const filteredEvents = await filterEventsForSync(userId, groupedEvents)` |
| `src/components/SyncDashboard.tsx` | `/api/parse-ics` | fetch GET on mount | WIRED | Line 85: `fetch('/api/parse-ics')` in useEffect |
| `src/components/SyncDashboard.tsx` | `/api/user-selections` | fetch PUT on checkbox/color change | WIRED | Lines 137, 158, 174: PUT to `/api/user-selections` in handlers |
| `src/components/SyncDashboard.tsx` | `/api/school-calendars` | fetch GET on mount | WIRED | Line 93: `fetch('/api/school-calendars')` in useEffect |
| `src/components/SyncButton.tsx` | `/api/sync` | fetch POST + poll /api/sync/status | WIRED | SyncDashboard handleSync (line 208): POST /api/sync; poll line 222: fetch `/api/sync/status?jobId=...` |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CANVAS-01 | 02-01, 02-03, 02-04 | User can paste Canvas ICS feed URL and see parsed courses | SATISFIED | SetupWizard stores canvasIcsUrl; parse-ics GET reads it from DB; dashboard displays courses in accordion |
| CANVAS-02 | 02-01, 02-03, 02-04 | User can select/deselect entire courses | SATISFIED | courseSelections table + user-selections PUT + CourseAccordion checkbox → handleToggleCourse |
| CANVAS-03 | 02-01, 02-03, 02-04 | User can select/deselect individual events within a course | SATISFIED | eventOverrides table + user-selections PUT eventOverrides array + EventRow checkbox → handleToggleEvent |
| CANVAS-04 | 02-02, 02-03 | Selected Canvas events push to personal Google Calendar with dedup | SATISFIED (implementation) / PARTIAL (tests) | syncCanvasEvents wires correctly; gcalSync tests fail due to mock gap |
| CANVAS-05 | 02-01, 02-02, 02-04 | Each course gets a distinct Google Calendar color | SATISFIED | assignCourseColors (1-11 round-robin) + color dot in CourseAccordion + ColorPicker 11-color dropdown |
| MIRROR-01 | 02-02, 02-03 | School Google Calendar events mirror one-way to personal account | SATISFIED | mirrorSchoolCalendars copies events verbatim, bulk dedup via schoolEventId; schoolMirror tests: 15/15 pass |
| MIRROR-02 | 02-01, 02-02, 02-03, 02-04 | User can choose which school calendars to mirror | SATISFIED | schoolCalendarSelections table + school-calendars GET/PUT + SchoolCalendarList checkbox UI |
| SYNC-01 | 02-03, 02-04 | User can trigger sync manually via "Sync Now" button | SATISFIED | SyncButton → handleSync → POST /api/sync → 202 + jobId → 500ms polling → SyncSummary |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/services/gcalSync.test.ts` | googleapis mock missing `calendarList.patch` — causes 15/18 tests to fail with TypeError | Blocker | Test suite reports 15 failures; CI/CD would block on this; the production code path is correct but unverified by tests |
| `src/app/api/sync-gcal/route.ts` | Deprecated route returning 410 Gone | Info | Intentional stub per Plan 04 deviation note; superseded by /api/sync |

### Human Verification Required

#### 1. End-to-End Sync to Google Calendar

**Test:** Sign in, configure Canvas ICS URL, click Sync Now on dashboard
**Expected:** Canvas events appear in per-course sub-calendars (e.g., "Canvas - Math 101") in personal Google Calendar; colors match the color dots in the dashboard; school calendar events appear in "School - CalendarName" sub-calendars if school account linked
**Why human:** Cannot verify actual Google Calendar API calls, sub-calendar creation, or event appearance without live OAuth credentials

#### 2. Summary Persistence Behavior

**Test:** Click Sync Now; wait for completion; observe summary; then toggle a course checkbox
**Expected:** Summary card shows inserted/updated/skipped counts; disappears immediately when user changes any selection or color; reappears with fresh data after next sync
**Why human:** DOM/React state behavior (clearSummary() called in handlers) requires browser interaction

#### 3. Color Picker Portal Positioning

**Test:** On dashboard with multiple courses, click color dot on the 3rd or 4th accordion card
**Expected:** 11-color picker appears above all other cards, not clipped behind siblings; clicking outside closes it
**Why human:** CSS stacking context / createPortal rendering requires browser visual verification; was a known bug fixed in Plan 04

#### 4. Progress Bar During Long Sync

**Test:** Trigger sync with 50+ events across multiple courses
**Expected:** Progress bar advances as events are processed; shows "X/Y events" counts; individual course progress accumulated
**Why human:** Real-time progress requires live API execution

## Gaps Summary

**One gap is blocking:** The googleapis mock in `src/services/gcalSync.test.ts` does not include `calendarList.patch`. When the implementation was correctly refactored (deviation in Plan 04) to call `calendar.calendarList.patch()` for setting colorId on a sub-calendar, the test mock was not updated. This causes 15 of 18 gcalSync tests to fail with `TypeError: Cannot read properties of undefined (reading 'patch')`.

**Root cause:** The fix was made in `gcalSubcalendars.ts` (line 51-58) but the `gcalSync.test.ts` mock only provides `calendars.insert` and `events.*` under the googleapis mock — `calendarList` is undefined when the test runs.

**Production code is correct** — the implementation calls `.catch(() => {})` on the `calendarList.patch` call (non-fatal), so production would not crash even if the Google Calendar API rejects it. However, in tests, the mock returns `undefined` for `calendarList` before the `.catch()` is reached, throwing a TypeError.

**Fix required:** Add `calendarList: { patch: jest.fn().mockResolvedValue({}) }` to the googleapis mock in `gcalSync.test.ts`.

---

_Verified: 2026-03-12T22:00:00Z_
_Verifier: Claude (gsd-verifier)_

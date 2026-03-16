---
phase: 04-event-type-grouping-sub-calendars-per-course-and-type
verified: 2026-03-15T00:00:00Z
status: human_needed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Toggle renders correctly in dashboard"
    expected: "Four checkboxes (Assignments, Quizzes, Discussions, Events) appear above the Canvas Courses section when courses are loaded"
    why_human: "React component render behavior and visual placement cannot be verified by static analysis alone"
  - test: "Toggle state persists after page reload"
    expected: "After checking/unchecking a type filter and reloading, the checkbox state reflects the DB value"
    why_human: "Requires a live browser session and DB round-trip to confirm server-read initial state matches what was saved"
  - test: "PATCH /api/user-settings optimistic revert on failure"
    expected: "If the PATCH request fails, the checkbox reverts to its previous state silently (no toast)"
    why_human: "Requires simulating a network failure — cannot verify failure path without running the app"
  - test: "Sync produces correctly-named type sub-calendars"
    expected: "After enabling type filters and clicking Sync Now, Google Calendar shows new sub-calendars named 'Canvas - CourseName — Assignments', '... — Quizzes', '... — Discussions', '... — Events' as applicable"
    why_human: "Requires a live Canvas feed, Google OAuth, and actual sync execution against the Neon DB"
  - test: "Old per-course sub-calendars are untouched"
    expected: "Existing 'Canvas - CourseName' calendars created before Phase 4 still appear in Google Calendar and are not deleted or modified by a sync run"
    why_human: "Requires prior-phase data in the DB and a live sync run to confirm non-destructive behavior"
---

# Phase 04: Event Type Grouping — Sub-Calendars per Course and Type Verification Report

**Phase Goal:** Users can opt in to type-based sub-calendar grouping so Canvas events are organized into per-(course, type) calendars (Assignments, Quizzes, Discussions, Events) instead of one calendar per course.

**Verified:** 2026-03-15
**Status:** human_needed (all automated checks pass; 5 items require live testing)
**Re-verification:** No — initial verification

---

## Design Evolution Note

The plans were written for a single `typeGroupingEnabled` boolean toggle. During execution (Plan 04-04), the design was revised to **always-on type grouping with 4 per-type filter checkboxes** (`syncAssignments`, `syncQuizzes`, `syncDiscussions`, `syncEvents`). This is a superior design that fully satisfies all phase requirements. All verification is conducted against the as-delivered design, not the original plan spec.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `classifyEventType('Submit Assignment: HW1 [CS 201]')` returns `'assignment'` | VERIFIED | `eventTypeClassifier.ts` line 20: `/^submit\s+(assignment:?\s+)?/i` regex; 11 tests pass |
| 2 | `classifyEventType('Quiz 1 [Math 101]')` returns `'quiz'` | VERIFIED | `eventTypeClassifier.ts` line 21: `/^quiz[:\s]/i` regex; test suite confirms |
| 3 | `classifyEventType` never throws — always returns a `CanvasEventType` | VERIFIED | try/catch wraps all regexes; fallback `return 'event'` at line 27 |
| 4 | `courseTypeCalendars` table exists in schema | VERIFIED | `schema.ts` lines 134-148: full table definition with unique index |
| 5 | `users` table has per-type sync columns (not `typeGroupingEnabled`) | VERIFIED | `schema.ts` lines 18-21: `syncAssignments`, `syncQuizzes`, `syncDiscussions`, `syncEvents` all `default(true)` |
| 6 | Every `CanvasEvent` produced by `parseCanvasFeed` has an `eventType` field | VERIFIED | `icalParser.ts` line 11: `eventType: CanvasEventType` in interface; line 75: `eventType: classifyEventType(summary)` in construction |
| 7 | `ensureTypeSubCalendar` creates sub-calendars named `'Canvas - Math 101 — Assignments'` | VERIFIED | `gcalSubcalendars.ts` lines 165-166: capitalize + pluralize logic; 11 tests including naming convention assertions |
| 8 | `ensureTypeSubCalendar` returns cached calendarId on second call without an API call | VERIFIED | `gcalSubcalendars.ts` lines 151-161: DB-first check returns early if `existing?.gcalCalendarId` |
| 9 | Type grouping always on: `syncCanvasEvents` routes all events to per-(course, type) sub-calendars | VERIFIED | `gcalSync.ts` lines 163-219: single always-on routing path using `ensureTypeSubCalendar`; no per-course fallback |
| 10 | Per-type filtering: disabled types are skipped before routing | VERIFIED | `gcalSync.ts` lines 164-170: `TYPE_TOGGLE_MAP` lookup + `if (!enabled[toggleKey])` skip |
| 11 | `announcement` type is grouped under `syncEvents` toggle | VERIFIED | `gcalSync.ts` line 91: `announcement: 'syncEvents'` in `TYPE_TOGGLE_MAP` |
| 12 | `extendedProperties.private.canvasSourceCalendarId='canvas'` set on every inserted event | VERIFIED | `gcalSync.ts` lines 73-76: `buildGcalEvent` sets `canvasSourceCalendarId: 'canvas'` |
| 13 | PATCH `/api/user-settings` persists per-type toggles to DB | VERIFIED | `user-settings/route.ts` lines 50-85: validates and updates `syncAssignments`/`syncQuizzes`/`syncDiscussions`/`syncEvents` individually |
| 14 | Sync route reads 4 per-type columns and passes `EnabledEventTypes` to `syncCanvasEvents` | VERIFIED | `sync/route.ts` lines 159-166: constructs `EnabledEventTypes` from `user.sync*` columns; passes as 5th arg |
| 15 | `TypeGroupingToggle` renders 4 per-type checkboxes; `SyncDashboard` renders it above Canvas Courses section | VERIFIED (static) | `TypeGroupingToggle.tsx` lines 15-20: 4 `EVENT_TYPES` entries; `SyncDashboard.tsx` lines 332-337: rendered when `!isLoading && hasCanvasUrl && courses.length > 0` |

**Score:** 15/15 truths verified (automated); 5 require human testing

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/services/eventTypeClassifier.ts` | `CanvasEventType` union + `classifyEventType` function | VERIFIED | 29 lines; exports both; try/catch safety |
| `src/services/eventTypeClassifier.test.ts` | 11 test cases for all 5 buckets + empty string | VERIFIED | File exists; 11 tests pass |
| `src/lib/db/schema.ts` | `courseTypeCalendars` table + 4 per-type columns on `users` | VERIFIED | Lines 18-21 (sync columns), lines 134-148 (table with unique index) |
| `drizzle/0001_sloppy_smiling_tiger.sql` | Migration with `course_type_calendars` CREATE TABLE | VERIFIED | File exists; contains `CREATE TABLE "course_type_calendars"` |
| `src/services/icalParser.ts` | `CanvasEvent.eventType: CanvasEventType` field populated | VERIFIED | Line 11 (interface), line 75 (construction), imports classifier |
| `src/services/gcalSubcalendars.ts` | `ensureTypeSubCalendar` DB-first function | VERIFIED | Lines 143-197; exports `ensureTypeSubCalendar`; imports `courseTypeCalendars` + `CanvasEventType` |
| `src/services/gcalSubcalendars.test.ts` | 11 tests for cache hit, naming, colorId, DB insert | VERIFIED | File exists; 11 tests pass |
| `src/services/gcalSync.ts` | Always-on type routing; `EnabledEventTypes`; `TYPE_TOGGLE_MAP` | VERIFIED | Lines 85-91 (map), 93-98 (interface), 118-124 (signature), 163-219 (routing loop) |
| `src/services/gcalSync.test.ts` | Per-type filtering describe blocks, type routing tests | VERIFIED | Contains `per-type filtering`, `type sub-calendar creation` describe blocks; 138 total tests pass |
| `src/app/api/user-settings/route.ts` | GET + PATCH endpoints for per-type settings | VERIFIED | Both handlers present; validates per-key booleans; updates users table |
| `src/components/TypeGroupingToggle.tsx` | 4-checkbox UI component with `accent-indigo-500` | VERIFIED | Lines 15-20 (4 types); `min-h-[44px]`; `accent-indigo-500`; `aria-label` per checkbox |
| `src/components/SyncDashboard.tsx` | Renders `TypeGroupingToggle`; `handleToggleEventType`; `initialEventTypeSettings` prop | VERIFIED | Lines 8, 57, 75, 195, 332-337 |
| `src/app/dashboard/page.tsx` | Reads 4 per-type columns from DB; passes `initialEventTypeSettings` | VERIFIED | Lines 33-38 (settings construction), line 45 (prop pass) |
| `src/app/api/sync/route.ts` | Builds `EnabledEventTypes` from user row; passes to `syncCanvasEvents` | VERIFIED | Lines 159-166 |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `icalParser.ts` | `eventTypeClassifier.ts` | `import { classifyEventType, CanvasEventType }` | WIRED | `icalParser.ts` line 2; used at line 75 |
| `gcalSubcalendars.ts` | `schema.ts` | `import { courseTypeCalendars }` | WIRED | `gcalSubcalendars.ts` line 10; used in `ensureTypeSubCalendar` query/insert |
| `gcalSync.ts` | `gcalSubcalendars.ts` | `import { ensureTypeSubCalendar }` | WIRED | `gcalSync.ts` line 18; called at line 174 |
| `gcalSync.ts` | `eventTypeClassifier.ts` | `import { CanvasEventType }` + `TYPE_TOGGLE_MAP` | WIRED | Lines 19, 85-91; `evt.eventType` used at line 165 |
| `TypeGroupingToggle.tsx` | `/api/user-settings` | PATCH fetch in `handleToggleEventType` | WIRED | `SyncDashboard.tsx` lines 199-206: `fetch('/api/user-settings', { method: 'PATCH', ... })` |
| `SyncDashboard.tsx` | `TypeGroupingToggle.tsx` | `import TypeGroupingToggle`; renders with settings + onToggle | WIRED | Lines 8, 332-337 |
| `sync/route.ts` | `gcalSync.ts` | passes `enabledEventTypes` as 5th arg to `syncCanvasEvents` | WIRED | Lines 75, 90-91 |
| `dashboard/page.tsx` | `SyncDashboard.tsx` | `initialEventTypeSettings` prop | WIRED | Lines 33-45 |

---

## Requirements Coverage

**Note:** GROUP-01 through GROUP-06 are referenced in `ROADMAP.md` as the phase's requirements, but they are **not defined in `REQUIREMENTS.md`**. REQUIREMENTS.md contains only AUTH-*, CANVAS-*, MIRROR-*, SYNC-* IDs from phases 1-3. GROUP-* IDs are phase 4-specific requirements that exist in ROADMAP.md and PLAN frontmatter but were never added to REQUIREMENTS.md. This is a documentation gap — the requirements are satisfied in code, but REQUIREMENTS.md is not updated.

| Requirement | Source Plans | Description (from ROADMAP context) | Status | Evidence |
|-------------|-------------|-------------------------------------|--------|---------|
| GROUP-01 | 04-01, 04-02 | `CanvasEventType` classifier + `courseTypeCalendars` schema | SATISFIED | `eventTypeClassifier.ts` + `schema.ts` + migration file |
| GROUP-02 | 04-01 | `users.typeGroupingEnabled` — **superseded** by 4 per-type columns | SATISFIED (as redesigned) | `schema.ts` lines 18-21: `sync_assignments/quizzes/discussions/events` replace the single boolean |
| GROUP-03 | 04-02, 04-03 | `syncCanvasEvents` routes events to per-(course, type) sub-calendars | SATISFIED | `gcalSync.ts` always-on routing via `ensureTypeSubCalendar` |
| GROUP-04 | 04-03 | Bulk dedup preserved per (course, type) bucket | SATISFIED | `gcalSync.ts` lines 182-195: one `events.list` per type sub-calendar |
| GROUP-05 | 04-04 | User-facing toggle UI for type grouping | SATISFIED (as redesigned) | `TypeGroupingToggle.tsx` with 4 checkboxes in `SyncDashboard.tsx` |
| GROUP-06 | 04-04 | Preference persists; sync route reads flag from DB | SATISFIED | `user-settings/route.ts` PATCH + `sync/route.ts` `EnabledEventTypes` construction |

**ORPHANED REQUIREMENTS:** GROUP-01 through GROUP-06 are not defined in `.planning/REQUIREMENTS.md`. They appear only in ROADMAP.md and plan frontmatter. REQUIREMENTS.md should be updated to include these for complete traceability.

---

## Anti-Patterns Found

No blocking or warning-level anti-patterns found in phase 4 files.

| File | Pattern Checked | Result |
|------|----------------|--------|
| `eventTypeClassifier.ts` | TODO/stub/empty returns | None |
| `gcalSubcalendars.ts` | TODO/stub/empty returns | None |
| `gcalSync.ts` | TODO/stub/empty returns | None |
| `user-settings/route.ts` | Stub implementations | None — full GET/PATCH logic |
| `TypeGroupingToggle.tsx` | Placeholder renders | None — full 4-checkbox UI |
| `SyncDashboard.tsx` | Orphaned imports/state | None — `TypeGroupingToggle` imported and used; `eventTypeSettings` state initialized and rendered |
| `dashboard/page.tsx` | Missing prop pass-through | None — `initialEventTypeSettings` passed correctly |

---

## Plan Spec vs. Delivered Design Discrepancies

These are design improvements, not failures. Documented for clarity.

| Plan Spec | Delivered | Impact |
|-----------|-----------|--------|
| Single `typeGroupingEnabled?: boolean` toggle | 4 per-type checkboxes (`syncAssignments`, `syncQuizzes`, `syncDiscussions`, `syncEvents`) | More granular control; all requirements still met |
| `if (typeGroupingEnabled)` routing branch (on/off) | Always-on routing with `EnabledEventTypes` filtering | Simpler code path; GROUP-03/04 still satisfied |
| `initialTypeGroupingEnabled` prop name | `initialEventTypeSettings: EventTypeSettings` | Prop exists and is wired correctly; name reflects 4-key object |
| `aria-label="Enable event type grouping"` (single checkbox) | `aria-label={`Sync ${label}`}` per checkbox (4 checkboxes) | Per-type aria labels are superior UX; plan spec was for old design |
| Migration adds `type_grouping_enabled` boolean | Migration adds `type_grouping_enabled`, then plan 04-04 drops it and adds 4 `sync_*` columns | Applied via neon serverless driver; DB state is correct |

---

## Human Verification Required

### 1. TypeGroupingToggle Visual Rendering

**Test:** Open dashboard in a browser with courses loaded (Canvas URL configured). Observe the area above the "Canvas Courses" section header.
**Expected:** A card containing 4 labeled checkboxes — Assignments, Quizzes, Discussions, Events — with the description text "Events are grouped into per-type sub-calendars..." visible below.
**Why human:** React component render tree and CSS class behavior cannot be confirmed by static file analysis.

### 2. Per-Type Preference Persistence

**Test:** Check "Assignments" and uncheck "Quizzes". Reload the page.
**Expected:** After reload, Assignments is checked and Quizzes is unchecked — matching what was saved.
**Why human:** Requires a live browser + DB round-trip: PATCH is sent, DB is updated, page.tsx reads from DB on next server render, `initialEventTypeSettings` reflects the saved state.

### 3. Optimistic Revert on PATCH Failure

**Test:** Throttle network to offline/block `/api/user-settings`. Toggle a checkbox.
**Expected:** The checkbox immediately flips (optimistic), then silently reverts to its prior state when the PATCH fails. No toast or error message.
**Why human:** Requires simulating a network failure; the `catch` revert path in `handleToggleEventType` cannot be triggered by static analysis.

### 4. Type Sub-Calendar Creation on Sync

**Test:** Enable all checkboxes. Click "Sync Now". After sync completes, open Google Calendar.
**Expected:** New sub-calendars appear named "Canvas - [CourseName] — Assignments", "Canvas - [CourseName] — Quizzes", etc. for each event type present in the Canvas feed. The `ensureTypeSubCalendar` DB-first cache means subsequent syncs do not create duplicates.
**Why human:** Requires live Google OAuth, Canvas ICS fetch, Neon DB connectivity, and Google Calendar API calls.

### 5. Old Per-Course Sub-Calendars Untouched

**Test:** If "Canvas - [CourseName]" sub-calendars exist from pre-Phase-4 syncs, run a sync after Phase 4.
**Expected:** Old "Canvas - CourseName" calendars still appear in Google Calendar — they are not deleted, renamed, or modified. New type sub-calendars are additive.
**Why human:** Requires prior-phase data in the DB and a live sync to confirm the non-destructive side-effect.

---

## Test Suite Results

| Test File | Tests | Status |
|-----------|-------|--------|
| `eventTypeClassifier.test.ts` | 11 | All pass |
| `icalParser.test.ts` | included in suite | All pass |
| `gcalSubcalendars.test.ts` | 11 | All pass |
| `gcalSync.test.ts` | 22 (includes per-type filtering + type sub-calendar creation describes) | All pass |
| Full suite (`npx jest --no-coverage`) | **138/138** | All pass |

TypeScript: `npx tsc --noEmit` exits 0 — no type errors.

---

## Gaps Summary

No gaps blocking goal achievement. All 15 automated truths are verified. The 5 human verification items are behavioral/integration tests that require a live environment.

**One documentation gap:** GROUP-01 through GROUP-06 are not defined in `.planning/REQUIREMENTS.md`. They are satisfied in code but the requirements file should be updated to include them for complete traceability. This does not affect functionality.

---

_Verified: 2026-03-15_
_Verifier: Claude (gsd-verifier)_

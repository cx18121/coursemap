---
phase: 04-event-type-grouping-sub-calendars-per-course-and-type
plan: 02
subsystem: services
tags: [icalParser, gcalSubcalendars, event-type, tdd, db-first]
dependency_graph:
  requires: [04-01]
  provides: [CanvasEvent.eventType, ensureTypeSubCalendar]
  affects: [gcalSync.ts (Wave 3 plan 03 will import ensureTypeSubCalendar)]
tech_stack:
  added: []
  patterns: [TDD red-green, DB-first cache pattern, irregular plural handling]
key_files:
  created:
    - src/services/gcalSubcalendars.test.ts
  modified:
    - src/services/icalParser.ts
    - src/services/icalParser.test.ts
    - src/services/gcalSubcalendars.ts
decisions:
  - "Quiz pluralization: 'quiz' ends in 'z' so appends 'zes' not 's', yielding 'Quizzes'"
  - "icalParser mock fix: ical.default.async.fromURL -> ical.async.fromURL (pre-existing bug, __esModule: true makes default import resolve correctly)"
metrics:
  duration: 10m
  completed: "2026-03-15"
---

# Phase 04 Plan 02: CanvasEvent eventType + ensureTypeSubCalendar Summary

**One-liner:** Extended CanvasEvent with `eventType: CanvasEventType` field populated at parse time, and added `ensureTypeSubCalendar` to gcalSubcalendars using the DB-first pattern against the `courseTypeCalendars` table.

## Tasks Completed

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 (RED) | Failing icalParser eventType tests | b5377ac | 2 tests failing as expected |
| 1 (GREEN) | Extend CanvasEvent with eventType field | f5466ed | 3/3 tests pass |
| 2 (RED) | Failing gcalSubcalendars ensureTypeSubCalendar tests | 7b037f8 | 11 tests failing as expected |
| 2 (GREEN) | Implement ensureTypeSubCalendar | 4030f07 | 11/11 tests pass, 134/134 full suite |

## What Was Built

### Task 1: CanvasEvent.eventType

`src/services/icalParser.ts` extended:
- Added `import { classifyEventType, CanvasEventType } from './eventTypeClassifier'`
- Added `eventType: CanvasEventType` to the `CanvasEvent` interface
- Added `eventType: classifyEventType(summary)` in the VEVENT construction block

`src/services/icalParser.test.ts` extended:
- Fixed pre-existing mock bug: `ical.default.async.fromURL` → `ical.async.fromURL`
- Added `eventType` assertions to existing test: 'quiz', 'event', 'event' for 3 events
- Added new test for `Submit Assignment` → `'assignment'`

### Task 2: ensureTypeSubCalendar

`src/services/gcalSubcalendars.ts` extended:
- Added imports for `courseTypeCalendars` and `CanvasEventType`
- Implemented `ensureTypeSubCalendar(calendar, userId, courseName, eventType, colorId)` following exact same DB-first pattern as `ensureSubCalendar`
- Calendar name: `Canvas - ${courseName} — ${typeLabel}` where typeLabel handles irregular plural ('quiz' → 'Quizzes')

`src/services/gcalSubcalendars.test.ts` created:
- 11 tests covering: DB cache hit (no API), cache miss (API called), all 5 naming conventions, colorId via calendarList.patch, DB insert after creation, return value

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing icalParser.test.ts mock access pattern**
- **Found during:** Task 1 RED phase
- **Issue:** `(ical.default.async.fromURL as jest.Mock)` was undefined — with `__esModule: true`, the default import `ical` already resolves to `{ async: { fromURL: jest.fn() } }`, so `.default` is an extra level that doesn't exist
- **Fix:** Changed all references to `(ical.async.fromURL as jest.Mock)` and `ical.async.fromURL`
- **Files modified:** src/services/icalParser.test.ts
- **Commit:** b5377ac

**2. [Rule 1 - Bug] Handle irregular plural for 'quiz' → 'Quizzes'**
- **Found during:** Task 2 GREEN phase (test failure)
- **Issue:** Simple `+ 's'` pluralization produced 'Quizs' instead of 'Quizzes'
- **Fix:** Added conditional: `base.endsWith('z') ? base + 'zes' : base + 's'`
- **Files modified:** src/services/gcalSubcalendars.ts
- **Commit:** 4030f07

**3. [Rule 1 - Bug] Fix FAKE_CALENDAR mock in gcalSubcalendars.test.ts**
- **Found during:** Task 2 GREEN phase
- **Issue:** `{} as calendar_v3.Calendar` caused `TypeError: Cannot read properties of undefined (reading 'insert')` because the empty object has no `.calendars.insert` method
- **Fix:** Created structured mock object `{ calendars: { insert: mockCalendarsInsert }, calendarList: { patch: mockCalendarListPatch } }`
- **Files modified:** src/services/gcalSubcalendars.test.ts
- **Commit:** 4030f07

## Verification

- `npx jest src/services/icalParser.test.ts --no-coverage`: 3/3 pass
- `npx jest src/services/gcalSubcalendars.test.ts --no-coverage`: 11/11 pass
- `npx jest --no-coverage`: 134/134 pass (no regressions)
- `grep 'eventType: CanvasEventType' src/services/icalParser.ts`: present
- `grep 'ensureTypeSubCalendar' src/services/gcalSubcalendars.ts`: present
- Naming convention test for 'Canvas - Math 101 — Assignments': present

## Self-Check: PASSED

Files verified:
- src/services/icalParser.ts — contains eventType field
- src/services/gcalSubcalendars.ts — contains ensureTypeSubCalendar export
- src/services/gcalSubcalendars.test.ts — created with 11 tests

Commits verified:
- b5377ac — test: RED icalParser
- f5466ed — feat: GREEN icalParser
- 7b037f8 — test: RED gcalSubcalendars
- 4030f07 — feat: GREEN gcalSubcalendars

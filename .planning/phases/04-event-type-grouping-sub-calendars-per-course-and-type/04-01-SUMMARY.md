---
phase: 04-event-type-grouping-sub-calendars-per-course-and-type
plan: "01"
subsystem: event-type-classifier
tags: [tdd, schema, classifier, drizzle, neon]
dependency_graph:
  requires: []
  provides:
    - CanvasEventType union type (src/services/eventTypeClassifier.ts)
    - classifyEventType pure function (src/services/eventTypeClassifier.ts)
    - courseTypeCalendars DB table (src/lib/db/schema.ts, drizzle/0001_sloppy_smiling_tiger.sql)
    - users.typeGroupingEnabled boolean column (src/lib/db/schema.ts)
  affects:
    - src/services/gcalSubcalendars.ts (Wave 2: imports courseTypeCalendars)
    - src/services/gcalSync.ts (Wave 2: calls classifyEventType when typeGroupingEnabled=true)
tech_stack:
  added: []
  patterns:
    - TDD (RED-GREEN) for pure functions
    - Drizzle ORM schema extension with uniqueIndex
    - Direct Neon migration via @neondatabase/serverless when drizzle-kit migrate lacks migration history
key_files:
  created:
    - src/services/eventTypeClassifier.ts
    - src/services/eventTypeClassifier.test.ts
    - drizzle/0001_sloppy_smiling_tiger.sql
    - drizzle/meta/0001_snapshot.json
  modified:
    - src/lib/db/schema.ts
    - drizzle/meta/_journal.json
decisions:
  - "Drizzle migration applied manually via neon serverless driver because __drizzle_migrations table was absent (no prior migrate invocation) — generated SQL re-created all tables but was not idempotent; applied only ADD COLUMN and CREATE TABLE for new additions directly"
  - "icalParser test failure confirmed pre-existing before this plan — deferred, out of scope"
metrics:
  duration: 15 minutes
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 5
---

# Phase 04 Plan 01: Event Type Classifier + DB Schema Summary

**One-liner:** Pure `classifyEventType` function (TDD, 11 tests) + `courseTypeCalendars` table and `users.typeGroupingEnabled` column migrated to Neon Postgres.

## What Was Built

### Task 1: TDD — eventTypeClassifier service

Created `src/services/eventTypeClassifier.ts` with:
- `CanvasEventType` union type: `'assignment' | 'quiz' | 'discussion' | 'announcement' | 'event'`
- `classifyEventType(summary: string): CanvasEventType` using regex prefix matching
- try/catch guarantees function never throws on any input — always returns a valid CanvasEventType

Created `src/services/eventTypeClassifier.test.ts` with 11 test cases covering:
- All 5 type buckets (assignment colon + no-colon, quiz colon + space, discussion colon + space, announcement, catch-all)
- Empty string safety
- CanvasEventType exhaustiveness check

### Task 2: DB Schema Extension

Modified `src/lib/db/schema.ts`:
- Added `typeGroupingEnabled: boolean('type_grouping_enabled').notNull().default(false)` to `users` table
- Added `courseTypeCalendars` table with unique index `course_type_cal_idx` on `(userId, courseName, eventType)`

Generated `drizzle/0001_sloppy_smiling_tiger.sql` via `drizzle-kit generate`.

Applied schema changes to Neon Postgres:
- `ALTER TABLE "users" ADD COLUMN "type_grouping_enabled" boolean DEFAULT false NOT NULL`
- `CREATE TABLE "course_type_calendars" (...)` with FK to users + unique index

## Verification

- `npx jest src/services/eventTypeClassifier.test.ts --no-coverage` — 11/11 tests pass
- `npx jest --no-coverage` — 121/122 tests pass (1 pre-existing `icalParser` failure, confirmed before this plan)
- `npx tsc --noEmit --skipLibCheck --isolatedModules src/services/eventTypeClassifier.ts src/lib/db/schema.ts` — exit 0
- Neon DB: `course_type_calendars` table exists, `users.type_grouping_enabled` column exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle-kit migrate attempted full rebuild due to missing migration history table**

- **Found during:** Task 2 — running `npx drizzle-kit migrate`
- **Issue:** The `__drizzle_migrations` table was absent in Neon (prior migrations were applied directly, not via `drizzle-kit migrate`). When migrate ran, it tried to re-apply all migrations from 0000 including CREATE TABLE for tables that already exist, causing `relation "course_selections" already exists` error.
- **Fix:** Applied only the two new DDL statements directly using `@neondatabase/serverless` node driver: `ALTER TABLE users ADD COLUMN type_grouping_enabled ...` and `CREATE TABLE course_type_calendars ...` plus unique index.
- **Files modified:** None (DB changes applied programmatically, migration SQL file kept as generated)
- **Commits:** d8520e7

### Deferred Items

- **Pre-existing `icalParser` test failure** (`src/services/icalParser.test.ts` — `TypeError: Cannot read properties of undefined (reading 'async')`): Confirmed pre-existing before this plan's changes. Out of scope.

## Commits

| Hash    | Message                                                                    |
|---------|----------------------------------------------------------------------------|
| b194d71 | feat(04-01): TDD — eventTypeClassifier service                             |
| d8520e7 | feat(04-01): extend DB schema — courseTypeCalendars table + users.typeGroupingEnabled |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/services/eventTypeClassifier.ts | FOUND |
| src/services/eventTypeClassifier.test.ts | FOUND |
| drizzle/0001_sloppy_smiling_tiger.sql | FOUND |
| commit b194d71 | FOUND |
| commit d8520e7 | FOUND |

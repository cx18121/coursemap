---
phase: 02-sync-pipeline
plan: "01"
subsystem: sync-pipeline
tags: [drizzle, schema, services, tdd, anthropic, filtering, colors]
dependency_graph:
  requires: []
  provides:
    - courseSelections table (userId+courseName, enabled, colorId, gcalCalendarId)
    - eventOverrides table (userId+eventUid, enabled default false, customTitle)
    - eventTitleCache table (originalTitle unique, cleanedTitle, shared)
    - schoolCalendarSelections table (userId+schoolCalendarId, enabled, gcalMirrorCalendarId)
    - filterEventsForSync function
    - ensureCourseSelections function
    - assignCourseColors function
    - GOOGLE_CALENDAR_COLORS constant
    - getCleanedTitle function
    - cleanTitlesBatch function
  affects:
    - src/lib/db/schema.ts
    - Neon Postgres database
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.78.0"
  patterns:
    - Drizzle ORM upsert with onConflictDoUpdate
    - Default-include pattern (no DB row = enabled)
    - AI title cleanup with DB cache and regex fallback
    - Round-robin color assignment from fixed palette
key_files:
  created:
    - src/services/syncFilter.ts
    - src/services/syncFilter.test.ts
    - src/services/colorAssignment.ts
    - src/services/colorAssignment.test.ts
    - src/services/titleCleanup.ts
    - src/services/titleCleanup.test.ts
  modified:
    - src/lib/db/schema.ts
    - package.json
    - package-lock.json
decisions:
  - Default-include pattern for course and event selections: no DB row means enabled
  - onConflictDoNothing for eventTitleCache inserts to avoid race condition errors
  - Regex removes both colon and non-colon Submit prefixes (Submit: and Submit prefix)
  - colorAssignment.ts uses onConflictDoUpdate targeting (userId, courseName) composite
metrics:
  duration: 11m 31s
  completed: "2026-03-12"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
---

# Phase 2 Plan 1: DB Schema Extension and Core Sync Services Summary

**One-liner:** 4 Drizzle tables pushed to Neon plus syncFilter, colorAssignment, and titleCleanup services with AI caching and 32 passing tests.

## What Was Built

### Task 1: DB Schema Extension

Added 4 new tables to `src/lib/db/schema.ts` and pushed to Neon via `drizzle-kit push`:

1. **courseSelections** — tracks user course enable/disable state, assigned colorId (default Blueberry=9), and gcalCalendarId after first sync. Unique index on `(userId, courseName)`.

2. **eventOverrides** — sparse table storing only exceptions (events explicitly disabled or renamed by user). No row = event is enabled. Unique index on `(userId, eventUid)`.

3. **eventTitleCache** — shared AI title cache, user-independent. Unique constraint on `originalTitle` prevents duplicate cleanup calls across all users.

4. **schoolCalendarSelections** — tracks which school Google calendars to mirror. Unique index on `(userId, schoolCalendarId)`, stores gcalMirrorCalendarId after first sync.

Also installed `@anthropic-ai/sdk@0.78.0`.

### Task 2: Service Modules

**syncFilter.ts:**
- `filterEventsForSync(userId, groupedEvents)` — applies course and event selection logic. Courses with no DB row default to enabled (auto-include new courses). Events with no override row default to enabled.
- `ensureCourseSelections(userId, courseNames)` — upserts rows for new courses so they appear in the UI immediately after parsing.

**colorAssignment.ts:**
- `GOOGLE_CALENDAR_COLORS` — maps colorId strings "1"-"11" to names (Lavender through Tomato).
- `assignCourseColors(userId, courseNames)` — assigns unused colorIds to new courses in round-robin order. Existing courses keep their current colorId. Upserts via `onConflictDoUpdate`.

**titleCleanup.ts:**
- `getCleanedTitle(rawTitle)` — checks DB cache first, then calls claude-3-haiku-20240307 if `ANTHROPIC_API_KEY` is set, otherwise applies regex fallback. Caches result with `onConflictDoNothing`.
- `cleanTitlesBatch(rawTitles)` — bulk cache lookup via `inArray`, then calls `getCleanedTitle` only for uncached titles. Deduplicates input.

## Test Results

All 32 tests pass across 3 suites:
- syncFilter.test.ts: 11 tests
- colorAssignment.test.ts: 10 tests
- titleCleanup.test.ts: 11 tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regex to handle Submit prefix without colon**
- **Found during:** Task 2 test run
- **Issue:** `regexCleanTitle` only stripped "Submit Assignment: " with colon. "Submit Midterm Paper [Art 101]" → "Submit Midterm Paper" (colon missing, so prefix not removed)
- **Fix:** Changed regex from `/^Submit(?:\s+Assignment)?:\s*/i` to `/^Submit(?:\s+Assignment)?:?\s+/i` — makes the colon optional, requires trailing whitespace to avoid over-matching
- **Files modified:** src/services/titleCleanup.ts
- **Commit:** d5c7cec (included in Task 2 commit)

## Self-Check: PASSED

- FOUND: src/services/syncFilter.ts
- FOUND: src/services/colorAssignment.ts
- FOUND: src/services/titleCleanup.ts
- FOUND commit 8dc2492: feat(02-01): extend DB schema with 4 new tables and push to Neon
- FOUND commit d5c7cec: feat(02-01): add syncFilter, colorAssignment, and titleCleanup services with tests

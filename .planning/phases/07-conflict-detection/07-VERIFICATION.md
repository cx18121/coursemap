---
phase: 07-conflict-detection
verified: 2026-03-17T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 7: Conflict Detection Verification Report

**Phase Goal:** Detect conflicts between synced Canvas events and manually edited Google Calendar events
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `syncedEvents` table has a `gcal_event_id` column after migration | VERIFIED | `src/lib/db/schema.ts` line 207: `gcalEventId: text('gcal_event_id')` — nullable, positioned between `gcalCalendarId` and `syncedAt` |
| 2  | Every GCal insert stores the returned event ID in `syncedEvents.gcalEventId` | VERIFIED | `gcalSync.ts` line 295-296: `const insertResponse = await calendar.events.insert(...); const gcalEventId = insertResponse.data.id ?? null` — passed to both `.values()` and `.onConflictDoUpdate set` |
| 3  | Every GCal update stores the existing event ID in `syncedEvents.gcalEventId` | VERIFIED | `gcalSync.ts` line 321: `const gcalEventId = existing.id ?? null` — passed to both `.values()` and `.onConflictDoUpdate set` in update branch |
| 4  | Dashboard shows a count of synced events modified in GCal since last sync | VERIFIED | `ConflictPanel.tsx` renders `{data.conflictCount}` in amber badge; mounted in `SyncDashboard.tsx` with same gate as DedupePanel |
| 5  | Expanding the conflict panel shows event list with Canvas title, due date, and GCal modified time | VERIFIED | `ConflictPanel.tsx` renders `c.summary`, `c.startAt`, `c.gcalUpdatedAt` per conflict list item (lines 99-103) |
| 6  | Conflict panel loads lazily on expand, not on page mount | VERIFIED | `handleToggle()` only calls `fetch('/api/sync/conflicts')` when `expanded` becomes true and `data === null`; no fetch on mount |
| 7  | Events within the 60-second grace window are NOT flagged as conflicts | VERIFIED | `route.ts` line 56: `if (updatedMs > syncedMs + GRACE_MS)` with `GRACE_MS = 60_000`; Test 5 confirms grace-window behavior |
| 8  | Events with null gcalEventId are skipped (not treated as conflicts) | VERIFIED | `route.ts` WHERE filter: `isNotNull(syncedEvents.gcalEventId)`; defensive guard line 46: `if (!row.gcalEventId) return`; Test 3 confirms |
| 9  | ConflictPanel cache resets after each sync completion | VERIFIED | `SyncDashboard.tsx` line 353: `setSyncVersion((v) => v + 1)` in sync complete handler; `<ConflictPanel key={syncVersion} />` forces remount |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | `gcalEventId` column on syncedEvents table | VERIFIED | Line 207: `gcalEventId: text('gcal_event_id')` — nullable, between `gcalCalendarId` and `syncedAt` |
| `src/lib/db/migrate-conflict-detection.ts` | ALTER TABLE migration adding `gcal_event_id` | VERIFIED | `ALTER TABLE synced_events ADD COLUMN IF NOT EXISTS gcal_event_id TEXT`; imports `neon`; calls `migrate().catch(console.error)` |
| `src/services/gcalSync.ts` | `gcalEventId` stored after insert and update | VERIFIED | 6 occurrences of `gcalEventId`: 2 variable declarations, 2 in `.values()`, 2 in `.onConflictDoUpdate set` |
| `src/services/gcalSync.test.ts` | Tests verifying gcalEventId is stored | VERIFIED | 3-test `describe('gcalEventId storage (CONFLICT-01/02)', ...)` block; mock schema includes `gcalEventId: 'gcalEventId'` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/sync/conflicts/route.ts` | GET endpoint returning `conflictCount` and conflict list | VERIFIED | Exports `GET`; returns `{ conflictCount: conflicts.length, conflicts }` with session guard, isNotNull filter, batched events.get, and grace window |
| `src/app/api/sync/conflicts/__tests__/syncConflicts.test.ts` | Unit tests for conflict detection logic | VERIFIED | 7 tests covering 401 flows, empty rows, null skip, conflict detection, grace window, deleted event skip, no-token 401 |
| `src/components/ConflictPanel.tsx` | Collapsible conflict display panel | VERIFIED | `'use client'`; `export default function ConflictPanel()`; lazy fetch on expand; amber badge; conflict list with all 3 required fields |
| `src/components/SyncDashboard.tsx` | ConflictPanel mounted in dashboard | VERIFIED | `import ConflictPanel from './ConflictPanel'`; `<ConflictPanel key={syncVersion} />`; `syncVersion` state and `setSyncVersion` wired |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/gcalSync.ts` | `src/lib/db/schema.ts` | `syncedEvents.gcalEventId` column reference | WIRED | `gcalEventId` used in `.values()` and `.onConflictDoUpdate` in both insert and update branches |
| `src/lib/db/migrate-conflict-detection.ts` | `synced_events` table | `ALTER TABLE ADD COLUMN` | WIRED | `ALTER TABLE synced_events ADD COLUMN IF NOT EXISTS gcal_event_id TEXT` — idempotent migration |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/ConflictPanel.tsx` | `/api/sync/conflicts` | `fetch` on panel expand | WIRED | `fetch('/api/sync/conflicts')` called inside `handleToggle()` only when expanding and `data === null` |
| `src/app/api/sync/conflicts/route.ts` | `src/lib/db/schema.ts` | `syncedEvents` query with `isNotNull(gcalEventId)` filter | WIRED | `isNotNull(syncedEvents.gcalEventId)` in `and(...)` WHERE clause |
| `src/components/SyncDashboard.tsx` | `src/components/ConflictPanel.tsx` | import and render in dashboard | WIRED | Line 5: `import ConflictPanel from './ConflictPanel'`; rendered at line 455 with `key={syncVersion}` |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CONFLICT-01 | 07-01, 07-02 | Dashboard shows how many synced events have been modified in GCal since last sync | SATISFIED | `ConflictPanel` amber badge shows `data.conflictCount`; endpoint `GET /api/sync/conflicts` returns `conflictCount`; mounted in `SyncDashboard` |
| CONFLICT-02 | 07-01, 07-02 | User can view list of conflicted events (Canvas title, due date, when GCal was modified) | SATISFIED | ConflictPanel expands to show list rendering `c.summary` (Canvas title), `c.startAt` (due date), `c.gcalUpdatedAt` (GCal modified time) |

**Orphaned requirements check:** No additional CONFLICT-* requirements mapped to Phase 7 in REQUIREMENTS.md beyond CONFLICT-01 and CONFLICT-02. Coverage is complete.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scan covered all 4 created/modified files (schema.ts, migrate-conflict-detection.ts, gcalSync.ts, gcalSync.test.ts, route.ts, syncConflicts.test.ts, ConflictPanel.tsx, SyncDashboard.tsx). No TODO/FIXME/placeholder comments, no empty implementations, no stub return patterns found.

---

## Test Results

All tests pass:

- `src/services/gcalSync.test.ts`: 28 tests (includes 3 new gcalEventId tests) — all green
- `src/app/api/sync/conflicts/__tests__/syncConflicts.test.ts`: 7 tests — all green
- Full suite: 181 tests across 20 test suites — all green, no regressions

---

## Commit Verification

All 5 documented commits verified in git history:

| Commit | Message |
|--------|---------|
| `a5d99c9` | feat(07-01): add gcalEventId column to syncedEvents schema and migration |
| `43d2b73` | test(07-01): add failing tests for gcalEventId storage in gcalSync |
| `20b24ef` | feat(07-01): wire gcalEventId storage in gcalSync insert and update branches |
| `99d86a7` | feat(07-02): add GET /api/sync/conflicts endpoint with TDD tests |
| `b343905` | feat(07-02): add ConflictPanel component and wire into SyncDashboard |

---

## Human Verification Required

### 1. ConflictPanel visual appearance and interaction

**Test:** Open the dashboard in a browser while logged in. Scroll to the ConflictPanel below DedupePanel. Click to expand.
**Expected:** Panel header shows "GCal Conflicts"; on expand, spinner briefly appears then resolves to "No conflicts detected..." or an amber-badged count with a list of events showing Canvas title, due date, and GCal edit timestamp.
**Why human:** Visual rendering and amber color differentiation from DedupePanel (indigo) cannot be verified programmatically.

### 2. Conflict count badge display after real sync

**Test:** Trigger a manual sync, then open ConflictPanel.
**Expected:** The panel remounts (cache cleared via `key={syncVersion}`), and a fresh fetch is triggered on next expand. If any synced events were manually edited in GCal since the last sync, the amber badge appears with the correct count.
**Why human:** Requires real GCal data with manually edited events; cannot be simulated in unit tests.

---

## Summary

Phase 7 fully achieves its goal. Both CONFLICT-01 and CONFLICT-02 requirements are satisfied:

- The DB foundation (Plan 01) correctly adds a nullable `gcalEventId` column to `syncedEvents` and wires the storage in both insert and update branches of `gcalSync.ts`.
- The detection layer (Plan 02) correctly implements the full pipeline: session-guarded GET endpoint, `isNotNull` DB filter, batched `events.get` API calls with 60-second grace window filtering, defensive null guard for safety, and JSON response with `conflictCount` and conflict array.
- The UI layer (Plan 02) correctly surfaces detection results through a lazy-loading accordion panel with amber badge and event list, wired into SyncDashboard with a `syncVersion` key for post-sync cache invalidation.

All artifacts are substantive (not stubs), all key links are wired, all 181 tests pass, and no anti-patterns were found.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_

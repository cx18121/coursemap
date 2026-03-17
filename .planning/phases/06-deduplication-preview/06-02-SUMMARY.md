---
phase: 06-deduplication-preview
plan: 02
subsystem: api, ui
tags: [drizzle, nextjs, react, postgres, canvas, dedup]

# Dependency graph
requires:
  - phase: 06-01
    provides: syncedEvents DB mirror table (synced_events) with userId/uid unique index
  - phase: 05-01
    provides: syncFilter.filterEventsForSync, getSession, db patterns
  - phase: 04-01
    provides: loadCourseTypeSettings, CanvasEvent type with Date start/end fields
provides:
  - GET /api/sync/preview endpoint returning { wouldCreate, wouldUpdate, wouldSkip }
  - DedupePanel component — collapsible, lazy-fetches on expand, color-coded counts
  - SyncDashboard wiring for DedupePanel gated on hasCanvasUrl && courses.length > 0
affects: [06-03, phase-07-conflict-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-only preview: read syncedEvents mirror without GCal API calls"
    - "Lazy fetch on accordion expand (summary !== null guard prevents re-fetch on re-expand)"
    - "Three-layer filter parity: course selections + event overrides + per-type settings applied to preview same as real sync"

key-files:
  created:
    - src/app/api/sync/preview/route.ts
    - src/app/api/sync/preview/__tests__/syncPreview.test.ts
    - src/components/DedupePanel.tsx
  modified:
    - src/components/SyncDashboard.tsx

key-decisions:
  - "hasChangedVsSnapshot accepts CanvasEvent directly (start/end are Date objects, not strings — plan docs were incorrect)"
  - "Date.parse() approach considered but rejected in favor of using CanvasEvent type directly — cleaner and linter-safe"
  - "No mounted gate in DedupePanel — pure count display, no timezone-sensitive rendering unlike CountdownPanel"

patterns-established:
  - "Preview pattern: diff Canvas feed against DB mirror to show create/update/skip counts without live API calls"
  - "Color coding: emerald-400 = new/created, sky-400 = changed/updated, text-secondary = unchanged — matches SyncSummary palette"

requirements-completed: [DEDUP-01]

# Metrics
duration: 14min
completed: 2026-03-17
---

# Phase 6 Plan 2: Deduplication Preview Summary

**DB-backed Canvas sync preview endpoint and DedupePanel UI showing create/update/skip counts on expand without GCal API calls**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T04:15:35Z
- **Completed:** 2026-03-17T04:29:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GET /api/sync/preview returns accurate { wouldCreate, wouldUpdate, wouldSkip } by diffing Canvas feed against syncedEvents DB mirror
- Preview applies all 3 filter layers (course selections, event overrides, per-type settings) — same logic as real sync
- DedupePanel collapsible accordion fetches on expand only, caches result, color-coded counts (emerald/sky/secondary)
- 7 new unit tests covering auth, empty canvas URL, create/update/skip, type filter exclusion, undefined user
- 171 total tests passing, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: GET /api/sync/preview endpoint with hasChangedVsSnapshot + tests** - `715103c` (feat)
2. **Task 2: DedupePanel component + SyncDashboard wiring** - `4b0cb2b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/sync/preview/route.ts` - Preview GET endpoint: Canvas feed diff against DB mirror, 3-layer filter parity
- `src/app/api/sync/preview/__tests__/syncPreview.test.ts` - 7 unit tests for all filter paths and edge cases
- `src/components/DedupePanel.tsx` - Collapsible panel, lazy fetch on expand, emerald/sky color coding
- `src/components/SyncDashboard.tsx` - Import and render DedupePanel gated on !isLoading && hasCanvasUrl && courses.length > 0

## Decisions Made
- `hasChangedVsSnapshot` accepts `CanvasEvent` directly — the plan documented `start: string; end: string` but the actual `CanvasEvent` interface from `icalParser.ts` has `start: Date; end: Date`. Using the real type is cleaner and avoids linter interference.
- No `mounted` gate in DedupePanel — pure count display with no timezone-sensitive rendering (unlike CountdownPanel which shows time-based strings)
- Fetch is cached in component state (`summary !== null` guard) so re-expanding the panel does not re-fetch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed hasChangedVsSnapshot type mismatch: CanvasEvent.start/end are Date, not string**
- **Found during:** Task 1 (preview endpoint implementation) — linter detected the discrepancy
- **Issue:** Plan's interface doc showed `start: string; end: string` for incoming event, but actual `CanvasEvent` from `icalParser.ts` has `start: Date; end: Date`. Using `new Date(incoming.start)` on a Date object causes `getTime()` to fail at runtime.
- **Fix:** Used `CanvasEvent` type directly in `hasChangedVsSnapshot` signature; called `.getTime()` directly without wrapping in `new Date()`. Updated test helpers to pass `new Date(...)` objects instead of ISO strings.
- **Files modified:** src/app/api/sync/preview/route.ts, src/app/api/sync/preview/__tests__/syncPreview.test.ts
- **Verification:** All 7 preview tests pass, full suite 171 tests green
- **Committed in:** `715103c` / `4b0cb2b`

---

**Total deviations:** 1 auto-fixed (Rule 1 - type correctness bug from incorrect plan documentation)
**Impact on plan:** Auto-fix essential for correct runtime behavior. No scope creep.

## Issues Encountered
- Linter (ESLint auto-fix) repeatedly rewrote `hasChangedVsSnapshot` parameter types — identified root cause (actual CanvasEvent type uses Date, not string) and aligned implementation with real type rather than fighting the linter.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GET /api/sync/preview is operational and returns accurate counts
- DedupePanel renders on the dashboard when Canvas URL is configured and courses are loaded
- Phase 6 Plan 2 complete — ready for Phase 7 (conflict detection) or any downstream consumer of the preview endpoint

---
*Phase: 06-deduplication-preview*
*Completed: 2026-03-17*

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/app/api/sync/preview/route.ts
- FOUND: src/app/api/sync/preview/__tests__/syncPreview.test.ts
- FOUND: src/components/DedupePanel.tsx
- FOUND commit: 715103c
- FOUND commit: 4b0cb2b

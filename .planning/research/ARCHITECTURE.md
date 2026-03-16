# Architecture Research

**Domain:** Canvas-to-Google-Calendar sync — v1.1 automation and visibility features
**Researched:** 2026-03-16
**Confidence:** HIGH (Vercel official docs, direct codebase inspection), MEDIUM (deduplication/conflict UI patterns)

## Standard Architecture

### System Overview

The four v1.1 features map onto three structural additions to the existing architecture:
a new cron entry point, a `syncLog` DB table, and two new UI panels. The core sync pipeline
(`parseCanvasFeed` → `filterEventsForSync` → `syncCanvasEvents` + `mirrorSchoolCalendars`) is
unchanged — it is called from both the existing manual trigger and the new cron endpoint.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   SyncDashboard (existing)                     │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐  │  │
│  │  │  CountdownPanel │  │ DedupePanel (NEW) │  │ ConflictPanel│  │  │
│  │  │  (NEW)          │  │                  │  │ (NEW)        │  │  │
│  │  └────────┬────────┘  └────────┬─────────┘  └──────┬───────┘  │  │
│  └───────────┼────────────────────┼────────────────────┼──────────┘  │
└──────────────┼────────────────────┼────────────────────┼─────────────┘
               │  HTTP              │  HTTP               │  HTTP
┌──────────────┼────────────────────┼────────────────────┼─────────────┐
│         Next.js App Router (Server)                                   │
│                                                                      │
│  ┌────────────────┐  ┌─────────────┐  ┌────────────────────────┐    │
│  │ /api/cron/sync │  │ /api/sync   │  │ /api/sync/preview      │    │
│  │ (NEW — GET,    │  │ (existing   │  │ (NEW — dry-run dedup   │    │
│  │  CRON_SECRET)  │  │  POST)      │  │  + conflict detection) │    │
│  └───────┬────────┘  └──────┬──────┘  └────────────┬───────────┘    │
│          │                  │                       │               │
│  ┌───────▼──────────────────▼───────────────────────▼────────────┐  │
│  │                      Sync Pipeline (existing, shared)          │  │
│  │  parseCanvasFeed → filterEventsForSync → syncCanvasEvents      │  │
│  │                                        + mirrorSchoolCalendars │  │
│  └───────────────────────────────────────────┬────────────────────┘  │
│                                              │                       │
│  ┌───────────────────────────────────────────▼────────────────────┐  │
│  │                 Database (Neon Postgres + Drizzle)              │  │
│  │  users | oauthTokens | courseSelections | eventOverrides        │  │
│  │  courseTypeCalendars | courseTypeSettings | classifierCache     │  │
│  │  schoolCalendarSelections | eventTitleCache                     │  │
│  │  syncLog (NEW) | syncConflicts (NEW)                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │       vercel.json: crons → GET /api/cron/sync (daily)         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New or Modified |
|-----------|---------------|-----------------|
| `/api/cron/sync` | Vercel cron entry point — queries all users with valid tokens, runs per-user sync, writes syncLog row | **NEW** |
| `/api/sync` (existing) | Manual sync trigger — unchanged except: writes syncLog row after completion | **MODIFIED** (add syncLog write) |
| `/api/sync/preview` | Dry-run endpoint — parses ICS + fetches existing GCal events, returns diff without writing; powers dedup + conflict panels | **NEW** |
| `SyncDashboard` | Existing dashboard wrapper — adds CountdownPanel, DedupePanel, ConflictPanel as collapsible sections | **MODIFIED** (adds panels) |
| `CountdownPanel` | Client component — reads parsed ICS events (from `/api/parse-ics`), computes days-until-due for upcoming assignments, renders sorted list | **NEW** |
| `DedupePanel` | Client component — calls `/api/sync/preview`, renders "already synced" vs "will be added" counts with per-event detail | **NEW** |
| `ConflictPanel` | Client component — reads conflict rows from `/api/sync/preview`, lets user choose "keep Canvas version" / "keep GCal version" / "skip" per conflict | **NEW** |
| `syncLog` table | One row per sync run (cron or manual) — stores userId, triggeredBy, startedAt, completedAt, insertedCount, updatedCount, skippedCount, failedCount, errors | **NEW** |
| `syncConflicts` table | Rows for detected conflicts — canvas event UID + gcal event id + field diffs; resolved by user or auto-resolved on next sync | **NEW** |
| `runSyncJob` (in `/api/sync/route.ts`) | Existing shared sync function — no body changes needed; wrap call site to write syncLog on completion | **MODIFIED** (thin wrapper) |

## Recommended Project Structure

New and modified files only (relative to current `src/`):

```
src/
├── app/
│   └── api/
│       ├── cron/
│       │   └── sync/
│       │       └── route.ts        # NEW — cron entry point, CRON_SECRET check, all-user loop
│       └── sync/
│           ├── route.ts            # MODIFIED — add syncLog.write() after runSyncJob completes
│           ├── preview/
│           │   └── route.ts        # NEW — dry-run: parse + diff, no GCal writes
│           └── status/
│               └── route.ts        # existing — unchanged
├── components/
│   ├── SyncDashboard.tsx           # MODIFIED — add CountdownPanel, DedupePanel, ConflictPanel
│   ├── CountdownPanel.tsx          # NEW — deadline countdown UI
│   ├── DedupePanel.tsx             # NEW — shows already-synced vs pending events
│   └── ConflictPanel.tsx           # NEW — conflict review and resolution UI
├── services/
│   └── syncLog.ts                  # NEW — writeSyncLog(userId, triggeredBy, summary) helper
└── lib/
    └── db/
        └── schema.ts               # MODIFIED — add syncLog and syncConflicts tables
```

### Structure Rationale

- **`/api/cron/sync/`**: Isolated from `/api/sync/` to keep the CRON_SECRET check in one explicit location. This also makes it trivial to add rate-limiting or per-user concurrency controls to cron runs only.
- **`/api/sync/preview/`**: Nested under `/api/sync/` because it is conceptually part of the sync pipeline (same services, no writes). A sibling route keeps it co-located with its context.
- **`services/syncLog.ts`**: Thin helper that both the manual route and the cron route call after a run. Avoids duplicating the DB insert in two places.
- **New UI panels as separate components**: `CountdownPanel`, `DedupePanel`, `ConflictPanel` are each independently foldable and independently loadable. Keeping them as separate files (not inlined into `SyncDashboard`) makes each independently testable.

## Architectural Patterns

### Pattern 1: Vercel Cron → Secured Route Handler → Shared Sync Pipeline

**What:** `vercel.json` declares a `crons` entry pointing to `GET /api/cron/sync`. Vercel sends `Authorization: Bearer $CRON_SECRET` when it invokes the route. The route checks that header, then queries all users who have both personal and school tokens (or just a Canvas ICS URL), and calls the same `runSyncJob`-equivalent logic that the manual trigger uses.

**When to use:** All scheduled background work on Vercel. `node-cron` and `setInterval` do not survive serverless function teardown.

**Trade-offs:**
- Pro: Zero extra infrastructure; no external scheduler or queue needed.
- Pro: Syncs are already idempotent (`canvasCanvasUid` dedup in `gcalSync.ts`) so double-firing is safe.
- Con: Vercel Hobby cron fires once/day with up to 59-min jitter within the specified hour.
- Con: Default Vercel Function timeout is 10s on Hobby, 60s on Pro. With many users or large feeds, this requires either `after()` for each user or a fan-out pattern. For the current user count (personal tool), serial processing with `after()` is sufficient.

**Security (HIGH confidence — official Vercel docs):**

```typescript
// src/app/api/cron/sync/route.ts
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... sync all users
}
```

**`vercel.json` entry:**

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Pattern 2: All-User Query Without a Session

**What:** The cron endpoint has no session. It must query users directly from the DB. The correct approach is to join users to oauthTokens and filter for users who have a personal token AND a Canvas ICS URL (or have a school token, depending on what sync types they use). Users with missing or expired tokens that cannot be refreshed are skipped silently.

**When to use:** Any background job that needs to operate on behalf of multiple users.

**Trade-offs:**
- Pro: Simple — no queue, no message broker, no external state.
- Con: If the user count grows, this loop will exceed function duration limits. For now (personal-scale), it is fine.

**Query pattern:**

```typescript
// Fetch all users with a Canvas ICS URL configured
const usersToSync = await db
  .select({ id: users.id, canvasIcsUrl: users.canvasIcsUrl })
  .from(users)
  .where(isNotNull(users.canvasIcsUrl));
// Then for each user, call getFreshAccessToken — it returns null if expired and unrefreshable,
// which is the signal to skip that user gracefully.
```

**Note:** `getFreshAccessToken` (in `tokens.ts`) already handles refresh — it decrypts the stored refresh token, calls the Google OAuth endpoint, updates the DB row, and returns the new access token. Returning `null` means the user must re-authenticate manually. The cron job should skip null-token users without failing.

### Pattern 3: Deadline Countdown Reads from Parsed ICS (Not DB)

**What:** The countdown panel calls the existing `/api/parse-ics` endpoint (which already runs `parseCanvasFeed` and returns structured `CanvasEvent[]` with `start` dates) and filters for events whose `start` date is in the future. It sorts by `start` ascending and renders days-until-due.

**When to use:** Whenever you need real-time event data from the Canvas feed. The DB does not store the full event list — only user preferences and GCal calendar IDs. The ICS feed is the authoritative source for event content and dates.

**Trade-offs:**
- Pro: No new DB table. Reuses the existing `/api/parse-ics` parse-and-classify pipeline including the classifier cache, so repeated calls are fast.
- Pro: Automatically shows newly-added Canvas events without waiting for a sync.
- Con: Requires an HTTP fetch to Canvas ICS on every dashboard load. This is already happening today for the course list display, so no additional latency is introduced.
- Con: Countdown is only as fresh as the Canvas ICS feed. Canvas typically has a propagation delay of minutes.

**Data flow:** `SyncDashboard` already fetches `/api/parse-ics` on load and stores `courses` with their events. `CountdownPanel` receives this same `courses` prop and computes countdown client-side — no additional API call needed.

### Pattern 4: Deduplication Dashboard Derived from a Dry-Run Diff

**What:** A new `/api/sync/preview` GET endpoint runs the same parse → filter pipeline as the real sync, then fetches existing GCal events from each sub-calendar (same bulk-fetch pattern as `syncCanvasEvents`) without writing anything. It returns three lists: `toInsert`, `toUpdate`, `unchanged`. The `DedupePanel` renders these lists.

**When to use:** Anytime you want to show the user what a sync would do before running it. This is the same diff logic already inside `syncCanvasEvents` — just extracted earlier in the call, before the actual insert/update calls.

**Trade-offs:**
- Pro: No new DB table needed. The "deduplicated" state is derived live from GCal.
- Pro: Preview is always accurate — it reflects the current GCal state, not a stale snapshot.
- Con: Makes real GCal API calls (read-only). Contributes to the Google API quota. Mitigate by making `DedupePanel` load on-demand (user expands it), not on initial dashboard load.
- Con: Preview can become stale if the user runs a sync in another tab. Acceptable — a "Refresh" button or re-triggering on next dashboard load handles this.

**No new DB table required.** The existing `courseTypeCalendars` table already stores the sub-calendar IDs needed for bulk-fetching existing GCal events.

### Pattern 5: Conflict Detection at Sync Time, Storage in DB

**What:** A "conflict" is an event that already exists in GCal (matched by `canvasCanvasUid`) but where the GCal version has been manually edited by the user (title or time changed relative to Canvas). Currently `hasChanged()` in `gcalSync.ts` detects this and overwrites silently. The new behavior: when `hasChanged()` is true AND the existing GCal event's `updated` timestamp post-dates the last sync, record the conflict in the `syncConflicts` table instead of overwriting.

**When to use:** Whenever Canvas content and user-edited GCal content diverge on the same event.

**Trade-offs:**
- Pro: Preserves user edits. Conflict detection is an add-on to the existing diff — no structural changes to `gcalSync.ts` beyond passing a `conflictMode` parameter.
- Pro: `syncConflicts` rows are small and bounded — conflicts are rare.
- Con: Requires a new DB table (`syncConflicts`) and a resolution UI. The table must be cleaned up when conflicts are resolved.
- Con: Detecting "user edited the GCal event" requires comparing the GCal event's `updated` time to the last sync time. The last sync time must be stored (hence the `syncLog` table is a prerequisite for conflict detection).

**Simplified alternative worth considering:** Instead of per-event conflict tracking, surface "these events would be overwritten" as a warning in the `DedupePanel` preview and let the user exclude them before syncing. This avoids the `syncConflicts` table entirely and requires no change to `gcalSync.ts`. Recommend starting here and adding full conflict storage only if user feedback demands it.

## Data Flow

### Cron Sync Flow

```
Vercel cron fires (daily) → GET /api/cron/sync
    |
    v
Check Authorization: Bearer $CRON_SECRET
    |
    v
SELECT users WHERE canvasIcsUrl IS NOT NULL
    |
    v
For each user (serial):
  getFreshAccessToken(userId, 'personal') → null? skip user
  parseCanvasFeed(user.canvasIcsUrl)
  filterEventsForSync(userId, groupedEvents)
  syncCanvasEvents(userId, filteredEvents, colorMap)
  mirrorSchoolCalendars(userId)
    |
    v
writeSyncLog(userId, 'cron', summary)
    |
    v
Return 200 { usersProcessed, totalSynced }
```

### Deadline Countdown Flow

```
SyncDashboard mounts
    |
    v
Fetch /api/parse-ics  (existing call — no change)
    |
    v
courses[] with events[].start already available in component state
    |
    v
CountdownPanel receives courses prop
    |
    v
Filter: events where start > now, sort by start ascending
Compute: daysUntil = Math.ceil((start - now) / 86400000)
    |
    v
Render sorted list with "X days" badges — no API call
```

### Deduplication Preview Flow

```
User expands DedupePanel (lazy load)
    |
    v
Fetch GET /api/sync/preview
    |
    v
Server: parseCanvasFeed + filterEventsForSync (same as sync)
    |
    v
For each sub-calendar (from courseTypeCalendars table):
  calendar.events.list()  (read-only, same query as syncCanvasEvents)
    |
    v
Run hasChanged() diff for each event → { toInsert[], toUpdate[], unchanged[] }
    |
    v
Return diff to client (no GCal writes)
    |
    v
DedupePanel renders: "X new, Y to update, Z already synced"
```

### Conflict Detection Flow (Sync Time)

```
syncCanvasEvents processes an event:
  existing = existingByUid.get(event.uid)  (already fetched)
    |
    v
If existing exists AND hasChanged(event, existing):
  Check existing.updated vs lastSyncAt from syncLog
    |
    if existing.updated > lastSyncAt:
      → User edited this event in GCal after last sync
      → Write row to syncConflicts (userId, uid, gcalEventId, fieldDiffs as JSON)
      → Skip overwrite (or overwrite + log, based on user setting)
    else:
      → Canvas updated the event → proceed with normal update (existing behavior)
```

### State Management

```
Server (DB)                              Client (React state in SyncDashboard)
-----------                              ------------------------------------
users.canvasIcsUrl          ← prop  →   hasCanvasUrl (existing)
syncLog (last row)          ← fetch →   lastSyncedAt (currently localStorage — migrate to DB)
syncConflicts rows          ← fetch →   ConflictPanel.conflicts[]
courseTypeCalendars         ← (hidden) → DedupePanel uses /api/sync/preview
icalParser output           ← /api/parse-ics → courses[].events[] → CountdownPanel
```

**Key change to `lastSyncedAt`:** Currently stored in `localStorage`. For cron-triggered syncs, `localStorage` is never updated. Migrate `lastSyncedAt` to `syncLog` table — dashboard reads it via API on load. `localStorage` fallback is safe to remove once `syncLog` is wired.

## New DB Tables

### `syncLog`

```
syncLog:
  id            serial PK
  userId        integer FK → users.id ON DELETE CASCADE
  triggeredBy   text ('manual' | 'cron')
  startedAt     timestamp with time zone
  completedAt   timestamp with time zone
  status        text ('complete' | 'error')
  insertedCount integer
  updatedCount  integer
  skippedCount  integer
  failedCount   integer
  errors        text[]   -- JSON array of error messages
```

**Index:** `(userId, startedAt DESC)` — for the dashboard's "last synced" query (SELECT WHERE userId = ? ORDER BY startedAt DESC LIMIT 1).

### `syncConflicts`

```
syncConflicts:
  id              serial PK
  userId          integer FK → users.id ON DELETE CASCADE
  eventUid        text        -- Canvas UID (same as eventOverrides.eventUid)
  gcalEventId     text        -- GCal event id on personal account
  calendarId      text        -- GCal sub-calendar id
  canvasSnapshot  jsonb       -- Canvas event fields at detection time
  gcalSnapshot    jsonb       -- GCal event fields at detection time
  detectedAt      timestamp with time zone
  resolvedAt      timestamp   -- null until user resolves
  resolution      text        -- null | 'keep_canvas' | 'keep_gcal' | 'skip'
```

**Index:** `(userId, resolvedAt) WHERE resolvedAt IS NULL` — for the ConflictPanel's "unresolved conflicts" query.

**Prerequisite for conflict detection:** `syncLog` must exist first — conflict detection compares `existing.updated` to the timestamp of the last completed sync.

## Build Order Considerations

Dependencies create this build sequence for v1.1:

1. **`syncLog` DB table + `syncLog.ts` service** — Required by both the cron endpoint and the conflict detection. Lowest risk, no new UI. Also unblocks migrating `lastSyncedAt` out of `localStorage`.
2. **`/api/cron/sync` route + `vercel.json` crons entry** — Pure server work. Calls existing `runSyncJob`-equivalent. Depends only on `syncLog`.
3. **`CountdownPanel`** — Pure UI addition. Reads data already fetched by `SyncDashboard` (`courses` state from `/api/parse-ics`). No backend changes required. Can be built in parallel with step 2.
4. **`/api/sync/preview` route** — Dry-run read of GCal. Depends on existing `parseCanvasFeed`, `filterEventsForSync`, `courseTypeCalendars` table. No new DB tables.
5. **`DedupePanel`** — Client component that calls `/api/sync/preview`. Depends on step 4.
6. **`syncConflicts` DB table** — Depends on `syncLog` (step 1). Required before step 7.
7. **Conflict detection in `gcalSync.ts`** — Small change to `syncCanvasEvents`: when `hasChanged()` is true and the GCal event was modified after last sync, write to `syncConflicts` instead of overwriting. Depends on `syncLog` (for last sync time lookup) and `syncConflicts` (step 6).
8. **`ConflictPanel` + resolution API** — Client component + a PATCH endpoint to mark a conflict resolved. Depends on steps 6–7.

**Recommended phase boundaries:**
- Phase 05: `syncLog` + cron endpoint + `CountdownPanel` — highest value, lowest risk
- Phase 06: `DedupePanel` via `/api/sync/preview` — medium complexity, read-only
- Phase 07: Conflict detection + `ConflictPanel` — most complex, depends on phases 05–06

## Anti-Patterns

### Anti-Pattern 1: Querying Users by Active Session in the Cron Handler

**What people do:** Check `getSession()` inside the cron handler to get the userId, then sync only that user.

**Why it's wrong:** Vercel cron invocations have no browser session. `getSession()` reads a cookie from the incoming request; the cron caller (Vercel infrastructure) sends no cookie. The result is always `null`, so no users get synced.

**Do this instead:** Authenticate the cron request via `CRON_SECRET` header, then query all qualifying users directly from the DB as shown in Pattern 2.

### Anti-Pattern 2: Storing Countdown Data in the DB

**What people do:** Add a `deadlines` table to cache upcoming events and serve the countdown from it.

**Why it's wrong:** The Canvas ICS feed is already parsed on every dashboard load for the course list. A separate `deadlines` table is a stale cache that can diverge from the live feed. `parseCanvasFeed` already calls `classifyEventsWithCache` which hits the DB classifier cache — subsequent parses of the same titles are fast.

**Do this instead:** Compute the countdown in the client from the `courses[].events[]` data already loaded by `SyncDashboard`. No extra API call, no cache invalidation problem.

### Anti-Pattern 3: Treating the DedupePanel as a Sync Source of Truth

**What people do:** Store the preview diff results in the DB, then use those stored results to decide what to sync next.

**Why it's wrong:** GCal state can change between when the preview was computed and when sync runs. Stale preview results lead to incorrect insert/update/skip decisions.

**Do this instead:** The real sync always re-fetches existing GCal events fresh (`existingByUid` map rebuilt per run). The preview is read-only display only — not an input to the sync engine.

### Anti-Pattern 4: Skipping CRON_SECRET Validation

**What people do:** Leave the cron route unprotected, relying on "nobody knows the URL."

**Why it's wrong:** The route URL is public. Any actor can trigger a full sync for all users, exhausting Google API quota or generating unwanted calendar events.

**Do this instead:** Always validate `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` as a Vercel environment variable (>= 16 random characters). Vercel injects it automatically into cron invocations.

### Anti-Pattern 5: Keeping `lastSyncedAt` in `localStorage` After Adding Cron

**What people do:** Keep the existing `localStorage.setItem('lastSyncedAt', ...)` pattern unchanged.

**Why it's wrong:** Cron-triggered syncs run server-side with no browser. `localStorage` is never updated. The UI shows a stale "Last synced" timestamp even after multiple automatic syncs have run.

**Do this instead:** Store `lastSyncedAt` in `syncLog`. The dashboard reads the latest completed sync from `syncLog` via a lightweight API call on load. `localStorage` can be kept as a client-side optimistic update only, with `syncLog` as the authoritative source.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel Cron | HTTP GET from Vercel infrastructure to `/api/cron/sync` | Hobby: once/day, up to 59-min jitter. Add `"crons"` block to `vercel.json`. |
| Google Calendar API (read, for preview) | Same `calendar.events.list` calls as `syncCanvasEvents` | `/api/sync/preview` adds read-only GCal calls at dashboard load time; contributes to quota. Load lazily. |
| Canvas ICS feed | Existing `parseCanvasFeed` via `node-ical.async.fromURL` | No change. Countdown uses data already fetched for course list display. |
| Neon Postgres | Drizzle ORM — two new tables (`syncLog`, `syncConflicts`) | Run Drizzle `generate` + `migrate` before deploying features that depend on them. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `/api/cron/sync` ↔ sync pipeline | Direct TypeScript function call (same process) | Cron handler calls the same helper functions as `/api/sync` — no HTTP between them |
| `/api/cron/sync` ↔ `syncLog.ts` | Direct function call | `writeSyncLog(userId, 'cron', summary)` after each user completes |
| `/api/sync` ↔ `syncLog.ts` | Direct function call | `writeSyncLog(userId, 'manual', summary)` after `runSyncJob` resolves |
| `/api/sync/preview` ↔ sync pipeline | Direct function call (parse + filter only) | Preview calls `parseCanvasFeed` and `filterEventsForSync` but NOT `syncCanvasEvents` |
| `CountdownPanel` ↔ `SyncDashboard` | React props — `courses` array passed down | No additional API calls from CountdownPanel; reads from parent's existing state |
| `DedupePanel` ↔ `/api/sync/preview` | Client `fetch()` — triggered on panel expand | Lazy: do not call on dashboard mount; call only when user opens the panel |
| `ConflictPanel` ↔ `syncConflicts` table | Via PATCH `/api/sync/conflicts/[id]` route | User picks resolution; route marks `resolvedAt` + `resolution` in DB |
| `gcalSync.ts` ↔ `syncConflicts` | Direct DB insert inside `syncCanvasEvents` | Only when `hasChanged()` is true AND GCal event updated after last sync |
| `gcalSync.ts` ↔ `syncLog` | Indirect — cron/manual routes query `syncLog` for last sync time before calling `syncCanvasEvents` | Pass `lastSyncAt: Date | null` as a parameter to `syncCanvasEvents` to avoid circular dependency |

## Sources

- [Vercel Cron Jobs — Manage Cron Jobs (securing cron jobs)](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — HIGH confidence (official docs, CRON_SECRET pattern verified)
- [Vercel Cron Jobs — Usage and Pricing (Hobby: once/day)](https://vercel.com/docs/cron-jobs/usage-and-pricing) — HIGH confidence
- Direct codebase inspection: `src/services/gcalSync.ts`, `src/app/api/sync/route.ts`, `src/lib/db/schema.ts`, `src/services/icalParser.ts`, `src/services/schoolMirror.ts`, `src/services/syncFilter.ts`, `src/components/SyncDashboard.tsx`, `src/lib/tokens.ts` — HIGH confidence

---
*Architecture research for: Canvas-to-GCal v1.1 — auto-sync, deadline countdown, deduplication dashboard, conflict resolution*
*Researched: 2026-03-16*

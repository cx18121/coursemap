# Phase 6: Deduplication Preview — Research

**Researched:** 2026-03-17
**Domain:** Drizzle ORM schema extension, DB-backed sync mirror, Next.js API Route, React collapsible UI
**Confidence:** HIGH

---

## Summary

Phase 6 gives users a preview of what the next sync will do (N events would be created, N updated, N
unchanged) without triggering an actual sync or making any Google Calendar API calls. The 500 ms
load constraint rules out any live GCal API approach, so the feature depends on a `syncedEvents` DB
mirror that is populated during each real sync. The dedup panel reads that mirror, diffs it against
the current Canvas feed (already in memory or re-fetchable from the same `/api/parse-ics` endpoint),
and displays counts.

There are two separable engineering problems:

1. **DB mirror (DEDUP-02):** A new `syncedEvents` table captures a lightweight snapshot of every
   event pushed to GCal during sync — uid, summary, start, end, calendarId. This table is written
   by the sync pipeline (both manual and cron paths) and is the sole data source for the preview.
   No GCal API calls are needed in the preview path.

2. **Preview API + panel (DEDUP-01):** A `GET /api/sync/preview` endpoint reads the Canvas feed
   and `syncedEvents` DB, applies the same diff logic used in `gcalSync.ts` (`hasChanged`), and
   returns `{ wouldCreate: N, wouldUpdate: N, wouldSkip: N }`. A new `DedupePanel` client
   component renders these counts in a collapsible accordion, loading them on expand (not on mount)
   to keep dashboard initial load fast.

The STATE.md locked decision is clear: "DedupePanel reads from syncedEvents DB mirror, not live GCal
API — prevents quota drain on every dashboard page view." This means the DB mirror must be written
during real syncs and the preview endpoint reads only from DB.

**Primary recommendation:** Add the `syncedEvents` DB table, wire its writes into `syncCanvasEvents`
(both the manual and cron paths already call it), then build the `GET /api/sync/preview` endpoint
and `DedupePanel` component.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEDUP-01 | User can see a pre-sync summary (N would be created / N updated / N unchanged) before committing a sync | `GET /api/sync/preview` reads Canvas feed + `syncedEvents` DB mirror; applies same `hasChanged` diff logic from `gcalSync.ts`; `DedupePanel` client component fetches on panel expand |
| DEDUP-02 | Synced event snapshots are stored in DB so the dedup panel loads without additional Google Calendar API calls | New `syncedEvents` table written by `syncCanvasEvents` after each GCal upsert; preview endpoint reads from DB only — zero GCal API calls |
</phase_requirements>

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.45.1 (existing) | `syncedEvents` table schema + upsert during sync | Already used throughout; `onConflictDoUpdate` pattern established |
| `@neondatabase/serverless` | ^1.0.2 (existing) | DB access from preview API route | Already used; works in serverless context |
| Next.js App Router Route Handler | 16.1.6 (existing) | `GET /api/sync/preview` | Standard pattern used by `/api/sync/last`, `/api/parse-ics`, etc. |
| React `useState` / `useEffect` | 19.x (existing) | DedupePanel lazy-load on expand | Already used in SyncDashboard and CountdownPanel |
| Tailwind CSS | ^4 (existing) | Collapsible panel UI matching existing design language | Already used throughout dashboard components |

### No New Dependencies

All capabilities are covered by the existing stack. No dedicated diffing library is needed — the
`hasChanged` function in `gcalSync.ts` is already the correct diff logic and can be imported
directly or duplicated into the preview service.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB mirror (`syncedEvents`) | Live GCal `events.list` API call | Live call drains quota and takes 200–800 ms per sub-calendar; violates 500 ms load requirement and DEDUP-02 |
| On-expand fetch | On-mount fetch | On-mount fetch adds latency to every dashboard load even when panel is never opened; on-expand is more efficient |
| Importing `hasChanged` from `gcalSync.ts` | Re-implementing diff in preview service | Import avoids duplication; both use identical `summary`, `description`, `start`, `end` comparison |

---

## Architecture Patterns

### Recommended Directory / File Structure

```
src/
├── app/
│   └── api/
│       └── sync/
│           └── preview/
│               ├── route.ts             # GET /api/sync/preview (new)
│               └── __tests__/
│                   └── syncPreview.test.ts  # (new)
├── lib/
│   └── db/
│       └── schema.ts                    # add syncedEvents table (new rows)
├── services/
│   └── gcalSync.ts                      # write syncedEvents after each GCal upsert (modified)
└── components/
    └── DedupePanel.tsx                  # 'use client' collapsible panel (new)
```

### Pattern 1: `syncedEvents` DB Table Schema

**What:** Stores a lightweight snapshot of every Canvas event that has been successfully pushed to
GCal. One row per (userId, uid) — the Canvas UID uniquely identifies the event. Updated on each
sync via `onConflictDoUpdate` so the mirror stays current.

**When to use:** Written by `syncCanvasEvents` after every successful `events.insert` or
`events.update`. Read by `GET /api/sync/preview`.

```typescript
// Source: Drizzle ORM pgTable pattern — same as syncLog and courseTypeCalendars
// lib/db/schema.ts — new table addition
export const syncedEvents = pgTable(
  'synced_events',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    uid: text('uid').notNull(),               // Canvas event UID (canvasCanvasUid)
    summary: text('summary').notNull(),        // event title at time of last sync
    description: text('description'),          // event description at time of last sync
    startAt: timestamp('start_at', { withTimezone: true, mode: 'date' }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'date' }).notNull(),
    gcalCalendarId: text('gcal_calendar_id').notNull(), // sub-calendar it lives in
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUidIdx: uniqueIndex('synced_events_user_uid_idx').on(t.userId, t.uid),
  })
);
```

**Migration note:** The project applies migrations directly via the Neon serverless driver (not
drizzle-kit migrate), per the STATE.md decision from Phase 4. Wave 0 of the plan must include the
raw `CREATE TABLE` statement.

### Pattern 2: Writing `syncedEvents` Inside `syncCanvasEvents`

**What:** After each `events.insert` or `events.update` GCal API call succeeds, upsert a
`syncedEvents` row for that event. After `events.list` bulk-fetch, deleted events (uid in DB but
not in GCal) can be pruned or left stale — for preview purposes, stale rows only affect the
"would update" count slightly, which is acceptable.

**When to use:** Inside the per-event try/catch in `gcalSync.ts`, after the `summary.inserted++` or
`summary.updated++` lines.

```typescript
// After a successful insert or update in gcalSync.ts
await db
  .insert(syncedEvents)
  .values({
    userId,
    uid: event.uid,
    summary: event.summary,
    description: event.description ?? null,
    startAt: new Date(event.start),
    endAt: new Date(event.end),
    gcalCalendarId: subCalId,
  })
  .onConflictDoUpdate({
    target: [syncedEvents.userId, syncedEvents.uid],
    // Note: Drizzle uses a composite unique index target
    set: {
      summary: event.summary,
      description: event.description ?? null,
      startAt: new Date(event.start),
      endAt: new Date(event.end),
      gcalCalendarId: subCalId,
      syncedAt: new Date(),
    },
  });
```

**Important:** The `onConflictDoUpdate` target for a composite unique index uses the index name,
not an array of columns, in Drizzle ORM. See Pattern 6 below for the correct Drizzle syntax.

### Pattern 3: `GET /api/sync/preview` Endpoint

**What:** A read-only endpoint that fetches the current Canvas feed and diffs it against the
`syncedEvents` DB mirror to produce preview counts. Applies the same filter logic as the real sync
(`filterEventsForSync`) so disabled courses and excluded events are correctly excluded from counts.

**When to use:** Called by `DedupePanel` when the user expands the panel.

```typescript
// app/api/sync/preview/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { users, syncedEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseCanvasFeed } from '@/services/icalParser';
import { filterEventsForSync } from '@/services/syncFilter';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user?.canvasIcsUrl) {
    return NextResponse.json({ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 0 });
  }

  // Parse current Canvas feed
  const groupedEvents = await parseCanvasFeed(user.canvasIcsUrl);
  // Apply same user-selection filters used by real sync
  const filteredEvents = await filterEventsForSync(session.userId, groupedEvents);

  // Load DB mirror — one query, no GCal API call
  const mirror = await db.query.syncedEvents.findMany({
    where: eq(syncedEvents.userId, session.userId),
  });
  const mirrorByUid = new Map(mirror.map((r) => [r.uid, r]));

  let wouldCreate = 0, wouldUpdate = 0, wouldSkip = 0;
  for (const event of filteredEvents) {
    const existing = mirrorByUid.get(event.uid);
    if (!existing) {
      wouldCreate++;
    } else if (hasChangedVsSnapshot(event, existing)) {
      wouldUpdate++;
    } else {
      wouldSkip++;
    }
  }

  return NextResponse.json({ wouldCreate, wouldUpdate, wouldSkip });
}
```

### Pattern 4: `hasChangedVsSnapshot` — Diff Against DB Snapshot

**What:** A variant of `hasChanged` from `gcalSync.ts` that compares a `CanvasEvent` against a
`syncedEvents` DB row (instead of a `calendar_v3.Schema$Event`). The comparison fields are
identical: summary, description, start datetime, end datetime.

```typescript
// Can live in the preview route or a shared util
function hasChangedVsSnapshot(
  incoming: CanvasEvent,
  snapshot: typeof syncedEvents.$inferSelect
): boolean {
  if (incoming.summary !== snapshot.summary) return true;
  if ((incoming.description ?? null) !== (snapshot.description ?? null)) return true;
  if (new Date(incoming.start).getTime() !== snapshot.startAt.getTime()) return true;
  if (new Date(incoming.end).getTime() !== snapshot.endAt.getTime()) return true;
  return false;
}
```

### Pattern 5: `DedupePanel` — Collapsible UI with Lazy Fetch

**What:** A `'use client'` collapsible accordion that mirrors the visual style of `CountdownPanel`.
Fetch only happens when the user expands the panel. Shows a loading spinner while fetching,
then renders the three counts. Does NOT need `mounted` guard (no timezone-sensitive rendering).

```typescript
// components/DedupePanel.tsx
'use client';

import { useState } from 'react';

interface DedupeSummary {
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
}

export default function DedupePanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DedupeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExpand() {
    setExpanded(true);
    if (summary !== null) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch('/api/sync/preview');
      if (!res.ok) throw new Error('Failed to load preview');
      setSummary(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading preview');
    } finally {
      setLoading(false);
    }
  }

  // Render: collapsed header button, expanded counts
}
```

### Pattern 6: Drizzle `onConflictDoUpdate` with Composite Unique Index

**What:** When the unique constraint spans two columns (userId, uid), Drizzle's
`onConflictDoUpdate` `target` must reference the index name or the column tuple. In Drizzle
`drizzle-orm/pg-core`, pass the indexed columns array directly:

```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
await db
  .insert(syncedEvents)
  .values(values)
  .onConflictDoUpdate({
    target: [syncedEvents.userId, syncedEvents.uid],
    set: { summary: values.summary, /* ... */ },
  });
```

This is the same pattern as `courseTypeCalendars` and `courseTypeSettings` (both use composite
unique indexes with `onConflictDoUpdate`). Confirmed working in this codebase.

### Anti-Patterns to Avoid

- **Making GCal `events.list` calls from the preview endpoint:** This violates DEDUP-02 and the
  500 ms load constraint. All preview data comes from the `syncedEvents` DB table only.
- **Fetching preview on dashboard mount:** This adds latency even when the panel is never opened.
  Fetch on user expand only.
- **Re-parsing the Canvas feed server-side without caching:** `parseCanvasFeed` makes a network
  call to Canvas and runs AI classification. Consider caching the parsed result in the DB or
  accepting this as the dominant latency driver (Canvas feed fetch is typically 200–400 ms).
- **Writing `syncedEvents` rows outside the main try/catch per event:** If the GCal call fails,
  the `syncedEvents` row must NOT be written. Only write the snapshot after a confirmed GCal
  success.
- **Showing mirror-only preview for school calendar events:** The `syncedEvents` mirror is for
  Canvas events only. School calendar mirror events are not snapshotted because they are not
  deduplicated by UID in the same way. The preview counts Canvas events only, which is correct
  per DEDUP-01.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff logic | Custom field-by-field comparator | `hasChanged` from `gcalSync.ts` (extract/import) | Already tested; same fields; avoids logic divergence |
| DB upsert | Manual SELECT + conditional INSERT/UPDATE | Drizzle `onConflictDoUpdate` | Atomic; established pattern in this codebase for 4 tables |
| Collapsible UI | Custom accordion component | Inline `useState` expand toggle | Panel is simple enough; no library needed; matches existing accordion pattern from `CourseAccordion.tsx` |
| Preview counts | Re-running actual sync in "dry-run" mode | DB mirror diff | Dry-run would require GCal API calls; DB diff is faster and offline |

**Key insight:** The entire value of Phase 6 comes from the DB mirror making the diff cheap. All
complexity is in correctly wiring the mirror write into the sync pipeline so it stays current.

---

## Common Pitfalls

### Pitfall 1: Canvas Feed Re-Parse Latency in Preview Endpoint

**What goes wrong:** `parseCanvasFeed` fetches from the Canvas ICS URL and runs AI classification.
On a cold call, this can take 500–1500 ms, violating the 500 ms load target.

**Why it happens:** The ICS fetch is a network round-trip to Canvas servers; AI classification
adds another round-trip on cache misses.

**How to avoid:** The AI classifier already uses a DB cache (`classifierCache` table), so
classification on repeat syncs is fast. The ICS fetch itself (~200–400 ms) is the dominant cost.
This is within budget if the panel only fetches on expand (not on mount). Document as acceptable
latency for the first expand; subsequent expands within the same session can cache the result in
component state (`summary !== null` guard in `DedupePanel`).

**Warning signs:** Preview endpoint takes > 1 second to respond on first load.

### Pitfall 2: `syncedEvents` Mirror Out of Sync After Failed Sync

**What goes wrong:** If a sync partially completes (some events inserted, then an error), the
DB mirror is partially updated. The preview shows stale counts for unwritten events.

**Why it happens:** Individual event writes succeed or fail independently inside the per-event
try/catch in `gcalSync.ts`.

**How to avoid:** This is acceptable behavior — the mirror reflects what actually made it to GCal.
A partial sync will show partial preview counts, which is accurate (those events are already in
GCal). Failed events remain "would create" in subsequent previews until they successfully sync.

**Warning signs:** Preview shows "0 would create" for events that are actually missing from GCal
after a partial failure. Acceptable for v1.1.

### Pitfall 3: Composite Index Target in Drizzle `onConflictDoUpdate`

**What goes wrong:** Passing a single column (e.g., `syncedEvents.uid`) as the target when the
unique constraint is on `(userId, uid)` causes a runtime error or no-op conflict detection.

**Why it happens:** Drizzle requires the `target` to match the exact unique index definition.

**How to avoid:** Pass `[syncedEvents.userId, syncedEvents.uid]` as the target array. This matches
the `uniqueIndex('synced_events_user_uid_idx').on(t.userId, t.uid)` definition. Verified: same
pattern used in `courseTypeCalendars` insert in this codebase.

**Warning signs:** Duplicate rows in `synced_events` table for the same (userId, uid); or Postgres
error on upsert mentioning unique constraint violation.

### Pitfall 4: Preview Showing School Calendar Events

**What goes wrong:** If `syncedEvents` accidentally captures school mirror events, the preview
counts become confusing — school events don't have Canvas UIDs and the diff logic is not designed
for them.

**Why it happens:** If `syncedEvents` writes are added to `schoolMirror.ts` as well as `gcalSync.ts`.

**How to avoid:** Write `syncedEvents` only inside `gcalSync.ts` (Canvas events). School mirror
events are identified by `canvasSourceCalendarId=school` extended property; keep them out of the
`syncedEvents` table entirely. The preview UI label should say "Canvas events" not "all events".

**Warning signs:** `wouldCreate`/`wouldUpdate`/`wouldSkip` counts include school calendar events.

### Pitfall 5: `DedupePanel` Mounted Before Canvas URL Is Set

**What goes wrong:** If `DedupePanel` is rendered when `hasCanvasUrl` is false, the preview
endpoint returns `{ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 0 }` but the UI might mislead
the user into thinking they have no events to sync.

**How to avoid:** Gate `DedupePanel` rendering on `hasCanvasUrl && courses.length > 0` in
`SyncDashboard`, same as `CountdownPanel`.

**Warning signs:** Panel renders with all-zero counts before Canvas feed is configured.

### Pitfall 6: typeGroupingEnabled Filter Mismatch

**What goes wrong:** The preview endpoint computes counts for ALL filtered Canvas events, but the
real sync may skip events of disabled types (per `courseTypeSettings`). The preview would show
"would create" for events the sync would actually skip.

**Why it happens:** `filterEventsForSync` handles course-level and per-event-override filters but
not per-type settings. The real sync applies type settings inside `syncCanvasEvents`.

**How to avoid:** The preview endpoint must also apply per-type settings. Load `courseTypeSettings`
for the user (same `loadCourseTypeSettings` function from `gcalSync.ts`) and skip events whose
type is disabled when computing counts.

**Warning signs:** Preview shows higher "would create" counts than the actual sync produces.

---

## Code Examples

### `syncedEvents` Table Schema

```typescript
// lib/db/schema.ts — add after syncLog
export const syncedEvents = pgTable(
  'synced_events',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    uid: text('uid').notNull(),
    summary: text('summary').notNull(),
    description: text('description'),
    startAt: timestamp('start_at', { withTimezone: true, mode: 'date' }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'date' }).notNull(),
    gcalCalendarId: text('gcal_calendar_id').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUidIdx: uniqueIndex('synced_events_user_uid_idx').on(t.userId, t.uid),
  })
);
```

### Raw Migration SQL (Wave 0)

```sql
-- Apply directly via Neon serverless driver (no drizzle-kit migrate)
CREATE TABLE IF NOT EXISTS synced_events (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uid         TEXT NOT NULL,
  summary     TEXT NOT NULL,
  description TEXT,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  gcal_calendar_id TEXT NOT NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT synced_events_user_uid_idx UNIQUE (user_id, uid)
);
```

### `hasChangedVsSnapshot` Diff Function

```typescript
// Compares incoming CanvasEvent against DB snapshot row
function hasChangedVsSnapshot(
  incoming: CanvasEvent,
  snapshot: { summary: string; description: string | null; startAt: Date; endAt: Date }
): boolean {
  if (incoming.summary !== snapshot.summary) return true;
  if ((incoming.description ?? null) !== (snapshot.description ?? null)) return true;
  if (new Date(incoming.start).getTime() !== snapshot.startAt.getTime()) return true;
  if (new Date(incoming.end).getTime() !== snapshot.endAt.getTime()) return true;
  return false;
}
```

### Drizzle Upsert for `syncedEvents`

```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
await db
  .insert(syncedEvents)
  .values({
    userId,
    uid: event.uid,
    summary: event.summary,
    description: event.description ?? null,
    startAt: new Date(event.start),
    endAt: new Date(event.end),
    gcalCalendarId: subCalId,
    syncedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: [syncedEvents.userId, syncedEvents.uid],
    set: {
      summary: event.summary,
      description: event.description ?? null,
      startAt: new Date(event.start),
      endAt: new Date(event.end),
      gcalCalendarId: subCalId,
      syncedAt: new Date(),
    },
  });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Live GCal `events.list` for dedup in sync | Bulk `events.list` per sub-calendar (1 call) | Phase 2 refactor | Reduced API calls from N to 1 per sub-calendar |
| Per-event dedup API call | In-memory UID map after bulk fetch | Phase 2 | Enables O(1) diff per event; no per-event API call |
| No preview / dry-run capability | DB mirror (`syncedEvents`) + preview endpoint | Phase 6 (this phase) | Preview without GCal quota usage |
| Sync summary only shown post-sync | Pre-sync preview available on-demand | Phase 6 (this phase) | User informed before committing sync |

**Deprecated/outdated for this phase:**
- Any approach reading from `calendar.events.list` in the preview path — violates DEDUP-02 quota constraint.

---

## Open Questions

1. **Should `syncedEvents` rows be pruned when a Canvas event is disabled by the user?**
   - What we know: If a user disables a course, events from that course still have `syncedEvents`
     rows. The preview correctly skips them (filterEventsForSync excludes them). The rows are stale
     but harmless.
   - What's unclear: Whether to purge `syncedEvents` rows for disabled events/courses on sync.
   - Recommendation: Do not purge — stale rows are harmless and cleanup adds complexity. Leave
     pruning as a v2 concern.

2. **Should the preview endpoint return per-course breakdown or only totals?**
   - What we know: DEDUP-01 says "counts of how many events would be created, updated, or left
     unchanged" — no mention of per-course breakdown.
   - Recommendation: Return totals only for v1.1. Per-course breakdown can be added to the panel
     as a future enhancement without API changes (just add per-course grouping to the endpoint).

3. **Canvas ICS re-parse latency: should the preview reuse the dashboard's already-parsed courses?**
   - What we know: `SyncDashboard` already has parsed courses in client state from `/api/parse-ics`.
     The preview endpoint re-parses server-side for accuracy (client state may not reflect latest
     feed).
   - What's unclear: Whether to pass the client-parsed events to the preview endpoint (query param
     or POST body) or always re-parse server-side.
   - Recommendation: Always re-parse server-side for correctness. The 200–400 ms Canvas fetch is
     acceptable for an on-expand load. If latency proves a problem in testing, a short-lived
     server-side cache (e.g., 60-second in-memory Map keyed by userId) can be added.

4. **Does the preview need to account for school calendar events?**
   - What we know: School mirror events are not UID-based in the same way; they are identified by
     Google Calendar event ID on the school account side. The `syncedEvents` table is Canvas-only.
   - Recommendation: Preview counts Canvas events only. Label clearly in the UI: "Canvas sync
     preview." School mirror events are excluded from preview scope.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --testPathPattern="syncPreview\|DedupePanel\|syncedEvents" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEDUP-01 | Preview endpoint returns `{ wouldCreate, wouldUpdate, wouldSkip }` when Canvas feed has new events vs. empty mirror | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-01 | Preview endpoint returns `wouldUpdate > 0` when mirror has stale summary vs. Canvas feed | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-01 | Preview endpoint returns `wouldSkip > 0` when mirror matches Canvas feed exactly | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-01 | Preview endpoint returns 401 when session is missing | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-01 | Preview endpoint excludes events from disabled courses (same as real sync filter) | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-01 | Preview endpoint excludes events from disabled courseTypeSettings | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-02 | `syncCanvasEvents` writes `syncedEvents` row after successful GCal insert | unit | `npx jest src/services/gcalSync --no-coverage` | Existing (modify) |
| DEDUP-02 | `syncCanvasEvents` updates `syncedEvents` row after successful GCal update | unit | `npx jest src/services/gcalSync --no-coverage` | Existing (modify) |
| DEDUP-02 | `syncCanvasEvents` does NOT write `syncedEvents` row when GCal call fails | unit | `npx jest src/services/gcalSync --no-coverage` | Existing (modify) |
| DEDUP-02 | `hasChangedVsSnapshot` returns `true` when summary differs | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |
| DEDUP-02 | `hasChangedVsSnapshot` returns `false` when all fields match | unit | `npx jest src/app/api/sync/preview --no-coverage` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="syncPreview\|DedupePanel\|gcalSync" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/sync/preview/__tests__/syncPreview.test.ts` — covers DEDUP-01 (all 6 behaviors)
- [ ] Migration script for `synced_events` table — must run before any sync writes attempt to use it
- [ ] `src/services/gcalSync.ts` test additions — extend existing `gcalSync.test.ts` for DEDUP-02 write behaviors (not a new file; additions to existing file)

*(No new test framework setup needed — Jest + ts-jest already configured.)*

---

## Sources

### Primary (HIGH confidence)

- `src/lib/db/schema.ts` — existing table patterns (`syncLog`, `courseTypeCalendars`) confirm Drizzle schema conventions used in this project
- `src/services/gcalSync.ts` — `hasChanged` function, `SyncSummary` type, per-event try/catch structure — all directly reusable for Phase 6
- `src/services/syncFilter.ts` — `filterEventsForSync` function signature; confirms which filters the preview must also apply
- `.planning/STATE.md` — locked decision: "DedupePanel reads from syncedEvents DB mirror, not live GCal API"; confirmed scope of Canvas-only preview
- `.planning/REQUIREMENTS.md` — DEDUP-01, DEDUP-02 exact wording and success criteria
- https://orm.drizzle.team/docs/guides/upsert — `onConflictDoUpdate` with composite target

### Secondary (MEDIUM confidence)

- `src/components/CountdownPanel.tsx` — on-mount lazy pattern; `mounted` guard; serves as direct UI template for `DedupePanel`
- `src/components/SyncSummary.tsx` — color-coded count display (`emerald-400` for created, `sky-400` for updated, `color-text-secondary` for unchanged) — reuse for visual consistency

### Tertiary (LOW confidence)

- None — all claims verified against project source files or official Drizzle docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing Drizzle + Neon + Next.js patterns cover all needs
- Architecture (DB schema): HIGH — directly mirrors `syncLog` and `courseTypeCalendars` patterns already in use
- Architecture (diff logic): HIGH — `hasChanged` function already exists in `gcalSync.ts`; reuse is straightforward
- Architecture (preview endpoint): HIGH — same pattern as `/api/sync/last`
- Pitfall: Pitfall 6 (type filter mismatch) is MEDIUM — requires careful implementation to apply `courseTypeSettings` filtering in the preview endpoint; easy to miss
- UI pattern: HIGH — `CountdownPanel` is a direct template; collapsible pattern from `CourseAccordion`

**Research date:** 2026-03-17
**Valid until:** 2026-06-01 (Drizzle ORM API stable at 0.45.x; Next.js route handler pattern stable)

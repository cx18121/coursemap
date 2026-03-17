# Phase 7: Conflict Detection — Research

**Researched:** 2026-03-17
**Domain:** Google Calendar API `updated` timestamp, Drizzle ORM schema extension, Next.js API Route, React collapsible UI
**Confidence:** HIGH

---

## Summary

Phase 7 lets users see when a Canvas event they have manually edited in Google Calendar no longer
matches what the last sync wrote. The dashboard shows a count of conflicted events (CONFLICT-01),
and expanding a panel shows each event's Canvas title, due date, and when GCal was last modified
(CONFLICT-02). Per-event conflict resolution (keep Canvas / keep GCal) is explicitly scoped to v1.2
— Phase 7 delivers detect-and-display only.

The core technical challenge is the **false-positive problem** flagged in STATE.md: if
`syncCanvasEvents` calls `events.patch` on every sync pass, GCal sets the `updated` field to the
current time, making every synced event appear conflicted immediately. The solution is to only call
`events.patch` when the event has actually changed (the `hasChanged` guard already exists), AND to
store the GCal event `updated` timestamp at the time of the last successful sync. A conflict is
defined as: the `updated` field on the live GCal event is newer than the `syncedAt` timestamp in the
`syncedEvents` DB mirror (with a grace window to handle clock skew and GCal internal processing
delays).

There are two separable problems:

1. **Schema extension:** The `syncedEvents` table needs a `gcal_event_id` column (the GCal event ID
   string, e.g. `"abcdef123"`). This column is needed so the conflict endpoint can call
   `events.get` per-event to fetch the live `updated` timestamp. Without the GCal event ID, there
   is no way to reference the specific event in GCal.

2. **Conflict endpoint + panel (CONFLICT-01, CONFLICT-02):** A `GET /api/sync/conflicts` endpoint
   queries `syncedEvents` for the user, calls `events.get` for each mirrored event to read the
   current `updated` timestamp, compares that timestamp against `syncedAt`, and returns a count
   and list of conflicted events. A `ConflictPanel` collapsible UI component renders the count in
   the header and the detail list on expand — parallel in structure to `DedupePanel`.

**Critical design choice:** To avoid the false-positive trap, the sync pipeline (`gcalSync.ts`)
must store `gcalEventId` in `syncedEvents` after each insert/update. The conflict detection
endpoint can then call `events.get` by that ID to read the current `updated` timestamp. This
requires a schema migration to add `gcal_event_id` to the `synced_events` table.

**Primary recommendation:** Add `gcal_event_id TEXT` to `synced_events`, wire it in `gcalSync.ts`
after each GCal upsert, then build `GET /api/sync/conflicts` and `ConflictPanel`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONFLICT-01 | Dashboard shows how many synced events have been modified in Google Calendar since the last sync | `GET /api/sync/conflicts` returns `{ conflictCount: N }` computed by comparing live GCal `event.updated` against `syncedEvents.syncedAt`; count shown in `ConflictPanel` header |
| CONFLICT-02 | User can view a list of those conflicted events (Canvas title, due date, when GCal was modified) | Same endpoint returns `conflicts: [{ uid, summary, startAt, gcalUpdatedAt }]`; list rendered inside collapsible `ConflictPanel` body |
</phase_requirements>

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | ^171.4.0 (existing) | `calendar.events.get` per-event to read live `updated` timestamp | Already used in `gcalSync.ts`; same `google.auth.OAuth2` pattern |
| Drizzle ORM | ^0.45.1 (existing) | Schema extension (`gcal_event_id` column), upsert updates in `syncCanvasEvents` | Established `onConflictDoUpdate` pattern used for 5+ tables |
| `@neondatabase/serverless` | ^1.0.2 (existing) | DB access from conflict endpoint | Already used; works in Vercel serverless environment |
| Next.js App Router Route Handler | 16.1.6 (existing) | `GET /api/sync/conflicts` endpoint | Same pattern as `/api/sync/preview` and `/api/sync/last` |
| React `useState` | 19.x (existing) | `ConflictPanel` lazy-load on expand | Same pattern as `DedupePanel` |
| Tailwind CSS | ^4 (existing) | Panel UI matching existing design system | Used throughout all dashboard components |

### No New Dependencies

All capabilities are covered by the existing stack. The GCal `events.get` API is part of
`googleapis` which is already installed and configured.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Live `events.get` per conflict check | Store GCal `updated` timestamp in DB at sync time | Storing the `updated` timestamp from GCal at sync time requires zero API calls on check, but any subsequent non-sync GCal edit would bump `updated` without the DB knowing — the stored value is only valid at the moment it was captured. Live `events.get` per check is more accurate. |
| `events.get` per event | `events.list` with `updatedMin` filter | `events.list` with `updatedMin` set to `lastSyncedAt` would return ALL events modified after that date — but this includes events the sync itself modified, making it useless for conflict detection without the false-positive filter. Per-event `events.get` is precise. |
| Polling all sub-calendars | Querying `syncedEvents` then fetching by GCal ID | Polling all sub-calendars via `events.list` is 1 call per sub-calendar, O(courses × types) calls. Fetching by GCal ID via `events.get` is O(conflicted events) — better if few conflicts exist. For the first load, the count is unknown, so we query `syncedEvents` (cheap DB query) and call `events.get` only for rows that are candidates. |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Directory / File Structure

```
src/
├── app/
│   └── api/
│       └── sync/
│           └── conflicts/
│               ├── route.ts                     # GET /api/sync/conflicts (new)
│               └── __tests__/
│                   └── syncConflicts.test.ts    # (new)
├── lib/
│   └── db/
│       ├── schema.ts                            # add gcal_event_id to syncedEvents (modified)
│       └── migrate-conflict-detection.ts        # ADD COLUMN migration script (new)
├── services/
│   └── gcalSync.ts                              # store gcalEventId after insert/update (modified)
└── components/
    └── ConflictPanel.tsx                        # 'use client' collapsible panel (new)
```

### Pattern 1: Schema Extension — `gcal_event_id` Column

**What:** Add `gcal_event_id TEXT` to the existing `synced_events` table. This stores the GCal
event ID (a string like `"abc123def456"` returned by `events.insert` or found on `events.get`).
Required for `events.get` calls during conflict detection.

**When to use:** Written by `syncCanvasEvents` after each successful GCal `events.insert` or
`events.update`. Read by `GET /api/sync/conflicts` to identify which GCal event to check.

```typescript
// Source: Drizzle ORM pgTable pattern — same as syncLog and courseTypeCalendars
// lib/db/schema.ts — extend existing syncedEvents table definition

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
    gcalEventId: text('gcal_event_id'),          // NEW in Phase 7 — GCal event ID string
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUidIdx: uniqueIndex('synced_events_user_uid_idx').on(t.userId, t.uid),
  })
);
```

**Migration note:** The project applies migrations directly via the Neon serverless driver (per
STATE.md Phase 4 decision). Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — not
`CREATE TABLE`. Existing rows will have `gcal_event_id = NULL`; the conflict check must handle
nulls gracefully (skip rows without a GCal event ID).

### Pattern 2: Storing `gcalEventId` in `syncCanvasEvents`

**What:** After each successful `events.insert` or `events.update`, extract the GCal event ID
from the API response and include it in the `syncedEvents` upsert.

**When to use:** Inside the per-event try/catch in `gcalSync.ts`, after the insert/update API
call returns.

```typescript
// gcalSync.ts — inside the insert branch
const insertResponse = await calendar.events.insert({
  calendarId: subCalId,
  requestBody: gcalEvent,
});
const gcalEventId = insertResponse.data.id ?? null; // GCal assigns an ID on insert

await db.insert(syncedEvents).values({
  userId,
  uid: event.uid,
  summary: event.summary,
  description: event.description ?? null,
  startAt: new Date(event.start),
  endAt: new Date(event.end),
  gcalCalendarId: subCalId,
  gcalEventId,                // NEW — store the GCal event ID
  syncedAt: new Date(),
}).onConflictDoUpdate({
  target: [syncedEvents.userId, syncedEvents.uid],
  set: {
    summary: event.summary,
    description: event.description ?? null,
    startAt: new Date(event.start),
    endAt: new Date(event.end),
    gcalCalendarId: subCalId,
    gcalEventId,              // NEW — update gcalEventId on re-insert
    syncedAt: new Date(),
  },
});

// For the update branch:
// existingByUid already has existing.id (the GCal event ID), so:
const gcalEventId = existing.id ?? null;
await calendar.events.update({ calendarId: subCalId, eventId: existing.id!, requestBody: gcalEvent });
await db.insert(syncedEvents).values({ ..., gcalEventId }).onConflictDoUpdate({ ..., set: { ..., gcalEventId } });
```

**Note:** For the update branch, `existing.id` is already the GCal event ID from the bulk
`events.list` response — no second API call needed.

### Pattern 3: `GET /api/sync/conflicts` Endpoint

**What:** A read endpoint that:
1. Loads all `syncedEvents` rows for the user that have a non-null `gcalEventId`.
2. Gets the user's access token via `getFreshAccessToken`.
3. Calls `calendar.events.get` for each row to read the current GCal `updated` timestamp.
4. Compares `gcalEvent.updated` against `syncedEvents.syncedAt`.
5. A conflict is detected if `updated > syncedAt + GRACE_WINDOW_MS`.
6. Returns `{ conflictCount: N, conflicts: [{ uid, summary, startAt, gcalUpdatedAt }] }`.

**Grace window:** Use 60 seconds (60000 ms). GCal internally sets `updated` a few seconds after
a `events.patch` / `events.update` call; a 60-second grace window absorbs clock skew and the
brief delay between the GCal write and `syncedAt` being written to the DB.

```typescript
// app/api/sync/conflicts/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { syncedEvents } from '@/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { getFreshAccessToken } from '@/lib/tokens';
import { google } from 'googleapis';

const GRACE_MS = 60_000; // 60 seconds

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load only rows with a known GCal event ID
  const rows = await db.query.syncedEvents.findMany({
    where: (t, { and, eq, isNotNull }) =>
      and(eq(t.userId, session.userId), isNotNull(t.gcalEventId)),
  });

  if (rows.length === 0) {
    return NextResponse.json({ conflictCount: 0, conflicts: [] });
  }

  const accessToken = await getFreshAccessToken(session.userId, 'personal');
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const conflicts: Array<{ uid: string; summary: string; startAt: string; gcalUpdatedAt: string }> = [];

  for (const row of rows) {
    try {
      const gcalEvent = await calendar.events.get({
        calendarId: row.gcalCalendarId,
        eventId: row.gcalEventId!,
      });
      const gcalUpdated = gcalEvent.data.updated;
      if (!gcalUpdated) continue;
      const updatedMs = new Date(gcalUpdated).getTime();
      const syncedMs = row.syncedAt.getTime();
      if (updatedMs > syncedMs + GRACE_MS) {
        conflicts.push({
          uid: row.uid,
          summary: row.summary,
          startAt: row.startAt.toISOString(),
          gcalUpdatedAt: gcalUpdated,
        });
      }
    } catch {
      // Skip deleted or inaccessible events — not a conflict, just gone
    }
  }

  return NextResponse.json({ conflictCount: conflicts.length, conflicts });
}
```

### Pattern 4: `ConflictPanel` — Collapsible UI with Lazy Fetch

**What:** A `'use client'` collapsible panel that mirrors `DedupePanel`'s structure. The conflict
count is shown in the collapsed header. On expand, the list of conflicted events is shown with
Canvas title, due date, and GCal last-modified time.

**When to use:** Rendered in `SyncDashboard` below `DedupePanel`, gated on `hasCanvasUrl &&
courses.length > 0` (same gate as `DedupePanel`).

```typescript
// components/ConflictPanel.tsx
'use client';

import { useState } from 'react';

interface ConflictEvent {
  uid: string;
  summary: string;
  startAt: string;
  gcalUpdatedAt: string;
}

interface ConflictData {
  conflictCount: number;
  conflicts: ConflictEvent[];
}

export default function ConflictPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ConflictData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (data !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/conflicts');
      if (!res.ok) throw new Error('Failed to load conflicts');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading conflicts');
    } finally {
      setLoading(false);
    }
  }
  // ...render collapsed header showing conflictCount badge, expanded rows per conflict
}
```

**Do NOT use `mounted` state gate** — conflict data is not timezone-sensitive. No hydration
mismatch risk (contrast with `CountdownPanel`).

### Anti-Patterns to Avoid

- **Polling all sub-calendars via `events.list` to find conflicts:** This O(courses × types)
  approach calls `events.list` per sub-calendar and checks all events, which is expensive and
  quota-wasteful. Use `events.get` keyed by the stored `gcalEventId` instead.
- **Writing `gcalEventId` before confirming the GCal call succeeded:** Extract the ID from the
  API response object, not from a pre-built request body.
- **Skipping the grace window:** Without a grace window, GCal's own internal `updated` bump
  immediately after a sync write will produce a false positive on every event that was inserted
  or updated. The 60-second window suppresses these.
- **Showing conflicts for events the user has disabled:** If a user disables a course, those
  events should not appear in the conflict list. Filter by applying `filterEventsForSync` or
  by querying only rows whose `uid` is in the current enabled set. The simpler approach: the
  conflict endpoint shows ALL DB-mirrored rows with `gcalEventId != NULL`, which is slightly
  broader than the current enabled set — acceptable for v1.1.
- **Loading conflict data on dashboard mount:** Same pattern as `DedupePanel` — only load on
  panel expand to avoid GCal API calls on every page view.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GCal `updated` field reading | Manually parsing event timestamps | `googleapis` `calendar.events.get` response `.data.updated` | Standard GCal REST field; already returned by the API |
| Upsert with `gcalEventId` | Manual SELECT + UPDATE | Drizzle `onConflictDoUpdate` with `target: [syncedEvents.userId, syncedEvents.uid]` | Established in this codebase; atomic; tested |
| Conflict panel collapsible | Custom accordion library | Inline `useState` toggle | Matches `DedupePanel` and `CourseAccordion` pattern; no library needed |
| False-positive suppression | Complex event comparison logic | Grace window (`syncedAt + 60s < gcalUpdated`) | Simple, robust, handles clock skew |
| DB migration | drizzle-kit migration files | Direct `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via Neon driver script | Per STATE.md Phase 4 decision — `__drizzle_migrations` table was absent; direct SQL is the established pattern |

**Key insight:** The hardest problem in this phase is not the UI or endpoint structure — it is the
false-positive trap. If `gcalSync.ts` calls `events.patch` (which bumps GCal's `updated`), every
event synced in the current run will appear conflicted in the next conflict check. The fix is already
half-done: `gcalSync.ts` only calls `events.update` when `hasChanged` returns true (skipped events
do not touch the GCal event). The remaining fix is storing `gcalEventId` and using a grace window.

---

## Common Pitfalls

### Pitfall 1: False Positives from Sync-Triggered `updated` Bumps (CRITICAL)

**What goes wrong:** After every sync, GCal sets `event.updated` to the current time on any event
that was touched by `events.insert` or `events.update`. If the conflict check runs immediately
after a sync, every recently synced event will appear modified — because they were modified by the
sync itself.

**Why it happens:** GCal's `updated` field reflects ANY write to the event, including writes made
by the app's own sync. There is no way to distinguish "user edited" from "app synced" in the
`updated` field alone.

**How to avoid:** Compare `gcalEvent.updated` against `syncedEvents.syncedAt`. The `syncedAt`
timestamp is set at the moment the sync writes the DB row — which is after the GCal write
returns. In practice, `syncedAt` is 0–5 seconds after the GCal write. Add a 60-second grace
window: only flag a conflict if `gcalEvent.updated > syncedAt + 60s`. This means a user must
wait 60 seconds after a sync before editing a GCal event for it to register as a conflict —
acceptable for this use case.

**Warning signs:** `conflictCount` equals the total number of synced events immediately after
running a sync.

### Pitfall 2: `gcalEventId` Column Null for Existing Rows

**What goes wrong:** Rows written by Phase 6's `syncCanvasEvents` do not have `gcalEventId`
(the column didn't exist yet). After the Phase 7 migration, those rows have `gcalEventId = NULL`.
The conflict endpoint fetching all rows and calling `events.get(null)` will throw a GCal API
error.

**Why it happens:** The migration adds the column but cannot backfill values — the GCal event IDs
are only known at sync time.

**How to avoid:** Filter `syncedEvents` rows by `gcalEventId IS NOT NULL` in the conflict query.
Rows without a GCal event ID simply won't appear in conflict checks until the user runs a sync
after Phase 7 is deployed (which populates `gcalEventId` for re-synced events). This is
acceptable degradation — on first deploy, conflict detection shows 0 conflicts and gradually
populates as events are re-synced.

**Warning signs:** GCal API error "Resource Not Found" or similar when `eventId` is null.

### Pitfall 3: Quota Exhaustion from Per-Event `events.get` Calls

**What goes wrong:** If a user has 200 synced events, the conflict endpoint makes 200 `events.get`
calls serially. At ~100ms per call, this takes ~20 seconds and may hit GCal's per-minute API
quota limit (initially 240 requests/minute for read operations).

**Why it happens:** Naive sequential iteration through all `syncedEvents` rows.

**How to avoid:** Two mitigations:
1. Lazy load — only call `events.get` when the user expands `ConflictPanel`, not on page mount.
2. Concurrency cap — process `events.get` calls in batches of 10 concurrent requests
   (Promise.all over 10-item slices), reducing wall time from 20s to ~2s for 200 events.
3. Optimistic shortcut: the `syncedAt` timestamp indicates the last sync time. Any `syncedEvents`
   row where `syncedAt` is newer than 60 seconds ago was just synced — skip it entirely (recently
   synced events can't be user-conflicted yet). This pre-filter can dramatically reduce API calls
   for users who just ran a sync.

**Warning signs:** Conflict panel takes > 5 seconds to load; GCal quota errors in logs.

### Pitfall 4: GCal Event Deleted by User

**What goes wrong:** If the user deleted the GCal event manually, `events.get` returns a 404.
The try/catch in the conflict endpoint must handle this gracefully.

**How to avoid:** Wrap each `events.get` call in try/catch; on error, continue to the next row.
A deleted event is not a conflict — it's simply gone. Optionally, schedule cleanup of orphaned
`syncedEvents` rows (out of scope for v1.1).

**Warning signs:** Unhandled 404 errors crashing the conflict endpoint.

### Pitfall 5: Clock Skew Between Vercel Server and GCal Servers

**What goes wrong:** The `syncedAt` timestamp is set by the Vercel server; the `gcalEvent.updated`
timestamp is set by Google's servers. If there is clock skew between them (rare but possible),
events that were just synced may falsely appear conflicted.

**How to avoid:** The 60-second grace window covers typical clock skew. For additional safety,
use `syncedAt` (written AFTER the GCal write returns) rather than the time the GCal write was
initiated — this means `syncedAt` is always slightly later than the GCal server's `updated`
timestamp for a sync-triggered write, which is the correct direction.

**Warning signs:** Freshly-synced events appear as conflicts for < 60 seconds then disappear.

### Pitfall 6: `events.patch` vs. `events.update` — GCal `updated` Behavior

**What goes wrong:** The current codebase uses `events.update` (full replace). If the planner
were to switch to `events.patch` (partial update), the `updated` field behavior is the same —
both operations bump `updated`. This is not a new risk, but worth documenting for clarity.

**How to avoid:** No action needed; `events.update` is already used. The grace window handles
the resulting `updated` bump.

---

## Code Examples

### Migration Script (Wave 0)

```typescript
// lib/db/migrate-conflict-detection.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE synced_events
    ADD COLUMN IF NOT EXISTS gcal_event_id TEXT
  `;
  console.log('Migration complete: gcal_event_id column added to synced_events');
}

migrate().catch(console.error);
```

### `syncCanvasEvents` — Storing `gcalEventId` (Insert Branch)

```typescript
// gcalSync.ts — insert branch
const insertResponse = await calendar.events.insert({
  calendarId: subCalId,
  requestBody: gcalEvent,
});
const gcalEventId = insertResponse.data.id ?? null;

await db.insert(syncedEvents).values({
  userId,
  uid: event.uid,
  summary: event.summary,
  description: event.description ?? null,
  startAt: new Date(event.start),
  endAt: new Date(event.end),
  gcalCalendarId: subCalId,
  gcalEventId,
  syncedAt: new Date(),
}).onConflictDoUpdate({
  target: [syncedEvents.userId, syncedEvents.uid],
  set: {
    summary: event.summary,
    description: event.description ?? null,
    startAt: new Date(event.start),
    endAt: new Date(event.end),
    gcalCalendarId: subCalId,
    gcalEventId,
    syncedAt: new Date(),
  },
});
summary.inserted++;
```

### `syncCanvasEvents` — Storing `gcalEventId` (Update Branch)

```typescript
// gcalSync.ts — update branch
// existing.id is the GCal event ID from the bulk events.list response
const gcalEventId = existing.id ?? null;
await calendar.events.update({
  calendarId: subCalId,
  eventId: existing.id!,
  requestBody: gcalEvent,
});
await db.insert(syncedEvents).values({
  userId,
  uid: event.uid,
  summary: event.summary,
  description: event.description ?? null,
  startAt: new Date(event.start),
  endAt: new Date(event.end),
  gcalCalendarId: subCalId,
  gcalEventId,
  syncedAt: new Date(),
}).onConflictDoUpdate({
  target: [syncedEvents.userId, syncedEvents.uid],
  set: {
    summary: event.summary,
    description: event.description ?? null,
    startAt: new Date(event.start),
    endAt: new Date(event.end),
    gcalCalendarId: subCalId,
    gcalEventId,
    syncedAt: new Date(),
  },
});
summary.updated++;
```

### Conflict Endpoint — Batched `events.get` Calls

```typescript
// Batch concurrency to avoid quota exhaustion
const BATCH_SIZE = 10;
const GRACE_MS = 60_000;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map(async (row) => {
      try {
        const gcalEvent = await calendar.events.get({
          calendarId: row.gcalCalendarId,
          eventId: row.gcalEventId!,
        });
        const gcalUpdated = gcalEvent.data.updated;
        if (!gcalUpdated) return;
        const updatedMs = new Date(gcalUpdated).getTime();
        const syncedMs = row.syncedAt.getTime();
        if (updatedMs > syncedMs + GRACE_MS) {
          conflicts.push({
            uid: row.uid,
            summary: row.summary,
            startAt: row.startAt.toISOString(),
            gcalUpdatedAt: gcalUpdated,
          });
        }
      } catch {
        // Deleted or inaccessible — not a conflict
      }
    })
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No conflict awareness | DB mirror (`syncedEvents`) + live `events.get` comparison | Phase 7 (this phase) | User can see when GCal edits diverge from Canvas |
| `syncedEvents` without GCal event ID | `syncedEvents` stores `gcalEventId` after sync | Phase 7 (this phase) | Enables direct `events.get` lookups for conflict detection |
| Per-event GCal API calls at dedup time | Bulk `events.list` per sub-calendar + in-memory map | Phase 2 | Reduced quota usage; conflict detection builds on this |

**Deprecated/outdated for this phase:**
- Polling `events.list` per sub-calendar for conflict detection — quota-wasteful; use `events.get`
  by stored `gcalEventId` instead.

---

## Open Questions

1. **Should `ConflictPanel` auto-refresh after a sync completes?**
   - What we know: `SyncDashboard` already re-fetches `/api/sync/last` after sync polling
     completes. It does not currently refresh `DedupePanel`.
   - What's unclear: Whether to invalidate the cached conflict data in `ConflictPanel` after a
     sync run (which may resolve conflicts by overwriting GCal edits).
   - Recommendation: Reset `ConflictPanel` data to `null` when `SyncDashboard` detects sync
     completion (pass a `key` prop or expose a reset callback). This ensures the next expand
     shows fresh data. The simplest approach: pass a `syncVersion` counter from `SyncDashboard`
     as a key to force remount on sync completion.

2. **Should conflicts show a "Resolve" action button?**
   - What we know: CONFLICT-03 (per-event resolution) is explicitly scoped to v1.2. Phase 7
     delivers detect-and-display only.
   - Recommendation: No action buttons in Phase 7. Optionally include placeholder text:
     "Run Sync Now to overwrite with Canvas version."

3. **What is the right grace window value?**
   - What we know: GCal processes writes within milliseconds on the server side. The `updated`
     field is set by GCal's servers immediately. The `syncedAt` DB write happens after the
     GCal response returns — typically 200–800ms of round-trip time is already baked in.
   - What's unclear: Whether there are cases where GCal's internal processing happens after the
     API response returns (e.g., calendar propagation delays).
   - Recommendation: 60 seconds is conservative and safe. Can be tightened to 10 seconds in
     practice if false positives are not observed after initial testing.

4. **How should the `ConflictPanel` header count behave before data is loaded?**
   - Recommendation: Show a dash or loading indicator in the collapsed header if the count is
     unknown. Do not show "0 conflicts" until data has been fetched. Match `DedupePanel`'s
     pattern of showing no badge until data is loaded.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --testPathPattern="syncConflicts\|ConflictPanel\|gcalSync" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CONFLICT-01 | Conflict endpoint returns `{ conflictCount: N }` when GCal `updated` is newer than `syncedAt + GRACE_MS` | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-01 | Conflict endpoint returns `conflictCount: 0` when GCal `updated` is within grace window | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-01 | Conflict endpoint returns 401 when session is missing | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-01 | Conflict endpoint skips rows with null `gcalEventId` | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-01 | Conflict endpoint skips events where GCal returns 404 (deleted) | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-02 | Conflict list items contain `uid`, `summary`, `startAt`, `gcalUpdatedAt` | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-02 | Conflict list excludes non-conflicted events (within grace window) | unit | `npx jest src/app/api/sync/conflicts --no-coverage` | Wave 0 |
| CONFLICT-01/02 | `syncCanvasEvents` stores `gcalEventId` in `syncedEvents` after successful insert | unit | `npx jest src/services/gcalSync --no-coverage` | Existing (extend) |
| CONFLICT-01/02 | `syncCanvasEvents` stores `gcalEventId` in `syncedEvents` after successful update | unit | `npx jest src/services/gcalSync --no-coverage` | Existing (extend) |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="syncConflicts\|gcalSync" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/sync/conflicts/__tests__/syncConflicts.test.ts` — covers all CONFLICT-01 and CONFLICT-02 behaviors listed above
- [ ] `src/lib/db/migrate-conflict-detection.ts` — ADD COLUMN migration script (must run before sync writes attempt `gcalEventId`)
- [ ] `src/services/gcalSync.ts` test additions — extend existing `gcalSync.test.ts` to assert `gcalEventId` is stored on insert and update (not a new file; additions to existing file)

*(No new test framework setup needed — Jest + ts-jest already configured.)*

---

## Sources

### Primary (HIGH confidence)

- `src/lib/db/schema.ts` — current `syncedEvents` table definition; confirms columns needed; `gcal_event_id` is absent and must be added
- `src/services/gcalSync.ts` — insert/update branch structure; `insertResponse.data.id` is the GCal event ID; `existing.id` from `events.list` is available for the update branch
- `src/components/DedupePanel.tsx` — direct UI template for `ConflictPanel`; lazy-fetch on expand; error/loading states
- `src/components/SyncDashboard.tsx` — how panels are rendered and gated; where `ConflictPanel` will be mounted
- `.planning/STATE.md` — locked decision "Per-event conflict resolution UI scoped to v1.2"; "conflict detection (Phase 7) depends on syncLog (Phase 5)"; false-positive risk from `syncCanvasEvents` calling `events.patch` flagged explicitly
- `.planning/REQUIREMENTS.md` — CONFLICT-01, CONFLICT-02 exact wording; CONFLICT-03 explicitly out of scope for Phase 7
- `src/app/api/sync/preview/route.ts` — established route handler pattern; same session guard, same DB query pattern

### Secondary (MEDIUM confidence)

- Google Calendar REST API documentation: `events.get` returns `updated` (RFC 3339 timestamp); confirmed field is always present on non-deleted events
- `googleapis` npm package: `calendar.events.get({ calendarId, eventId })` returns `data.updated` string — same pattern used by `calendar.events.list` in `gcalSync.ts`

### Tertiary (LOW confidence)

- None — all critical claims verified against project source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; `googleapis` already wired; Drizzle upsert pattern established
- Schema extension: HIGH — `ALTER TABLE ADD COLUMN IF NOT EXISTS` is a safe, established migration pattern in this project
- False-positive fix (grace window): HIGH — logic is straightforward; `syncedAt` is written after GCal returns, guaranteeing it is always slightly newer than the GCal `updated` for a sync-triggered write
- Architecture (endpoint + panel): HIGH — direct structural parallel to `DedupePanel` + `GET /api/sync/preview`; no novel patterns needed
- Pitfall 3 (quota): MEDIUM — depends on user's event count; batching mitigates; flagged for monitoring

**Research date:** 2026-03-17
**Valid until:** 2026-06-01 (GCal `updated` field behavior is stable; `googleapis` API is stable at 171.x)

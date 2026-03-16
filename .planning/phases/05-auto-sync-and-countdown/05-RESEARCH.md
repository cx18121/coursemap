# Phase 5: Auto-Sync and Countdown — Research

**Researched:** 2026-03-16
**Domain:** Vercel Cron Jobs, Drizzle ORM schema extension, timezone-safe React UI
**Confidence:** HIGH

---

## Summary

Phase 5 introduces two independent capabilities: a daily background cron that syncs all registered
users automatically, and a dashboard panel that buckets upcoming Canvas deadlines by proximity in
the user's local timezone.

The cron is a standard Vercel Cron Job pointing at a new GET route (`/api/cron/sync`). It iterates
every user row, wraps each user's sync in a `try/catch`, and writes a `syncLog` row regardless of
outcome. The existing `runSyncJob` logic in `/api/sync/route.ts` is reusable — it just needs to be
extracted into a shared helper that accepts a `userId` directly without a session cookie.

The countdown panel reads the raw Canvas event list already fetched by `/api/parse-ics`, groups
events by due-date proximity in the browser, and renders as a `'use client'` component. No new API
endpoint is needed. Doing the bucketing on the client avoids React hydration mismatches caused by
server-side `new Date()` producing UTC-based HTML that diverges from the user's local timezone.

The largest engineering decision already locked in STATE.md: `lastSyncedAt` must migrate from
`localStorage` to a `syncLog` DB table so cron results are visible to the dashboard without the
user pressing "Sync Now" first.

**Primary recommendation:** Build the DB schema extension and cron route first (CRON-01, CRON-02,
CRON-03), then wire the dashboard to read `lastSyncedAt` from a new `/api/sync/last` endpoint, and
finally add the client-only countdown panel (COUNTDOWN-01).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRON-01 | Daily Vercel cron automatically syncs Canvas and school calendar for every registered user without manual action | Vercel Cron Jobs GET route + `export const maxDuration = 300` pattern; reuse `runSyncJob` extracted to shared helper |
| CRON-02 | Dashboard shows accurate last-synced timestamp and status after a background cron run (not just after manual syncs) | New `syncLog` DB table + `/api/sync/last` endpoint; SyncDashboard reads from API on mount instead of `localStorage` |
| CRON-03 | A single user's auth failure or sync error does not abort the cron loop for other users | Per-user `try/catch` in the cron user loop; write failed status to `syncLog` then `continue` to next user |
| COUNTDOWN-01 | Dashboard shows upcoming Canvas deadlines grouped into Overdue / Due Today / Due Tomorrow / Due This Week, calculated in the user's local timezone | `'use client'` CountdownPanel component; bucket events using `Date` comparisons in browser; feed from already-available `/api/parse-ics` response |
</phase_requirements>

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel Cron Jobs | Platform feature | Triggers HTTP GET at schedule | Built-in Vercel platform feature; no external scheduler needed |
| Drizzle ORM | ^0.45.1 (existing) | `syncLog` table schema + upsert | Already used throughout the project |
| `@neondatabase/serverless` | ^1.0.2 (existing) | DB access from cron route | Already used; works in serverless edge context |
| Next.js App Router Route Handler | 16.1.6 (existing) | `GET /api/cron/sync` | Standard pattern for Vercel Cron integration |
| React `useState` / `useEffect` | 19.x (existing) | CountdownPanel timezone bucketing | Already used in SyncDashboard; client-only pattern |

### No New Dependencies

All required capabilities are covered by the existing stack. No `date-fns`, `luxon`, or countdown
library is needed. The bucketing logic (`isToday`, `isTomorrow`, `isThisWeek`, overdue) is a
handful of `Date` comparisons that are trivial without a library and carry zero risk of adding
ESM/CJS mismatch to the test environment.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `Date` comparisons | `date-fns` | `date-fns` reduces boilerplate but adds a dependency; native `Date` is sufficient for 4 bucket comparisons |
| Vercel Cron | External cron (cron-job.org, GitHub Actions) | External cron adds environment variable management complexity; Vercel Cron is zero-config and free |
| DB syncLog | Redis / KV store | Overkill; DB is already present and Drizzle upsert is straightforward |

---

## Architecture Patterns

### Recommended Directory / File Structure

```
src/
├── app/
│   └── api/
│       ├── cron/
│       │   └── sync/
│       │       └── route.ts         # GET /api/cron/sync (new)
│       └── sync/
│           ├── last/
│           │   └── route.ts         # GET /api/sync/last (new)
│           ├── route.ts             # POST /api/sync (existing, extract runSyncForUser)
│           └── __tests__/
│               └── cronSync.test.ts # (new unit tests)
├── lib/
│   └── db/
│       └── schema.ts                # add syncLog table (new rows)
└── components/
    └── CountdownPanel.tsx           # 'use client' deadline bucketing (new)
```

### Pattern 1: Vercel Cron Route with CRON_SECRET Auth

**What:** A `GET` route handler that Vercel calls on a schedule. Auth is via `Authorization: Bearer
<CRON_SECRET>` header set automatically by Vercel. The route MUST NOT call `getSession()` — there
is no browser cookie in a cron invocation.

**When to use:** Any route triggered by Vercel Cron.

```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// app/api/cron/sync/route.ts
import type { NextRequest } from 'next/server';

export const maxDuration = 300; // Pro plan maximum

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch all users from DB — do NOT call getSession()
  const allUsers = await db.select().from(users);

  const results = [];
  for (const user of allUsers) {
    try {
      await runSyncForUser(user.id, user.canvasIcsUrl);
      await upsertSyncLog(user.id, 'success');
      results.push({ userId: user.id, status: 'success' });
    } catch (err) {
      // CRON-03: one user failure must not abort the loop
      await upsertSyncLog(user.id, 'error', String(err));
      results.push({ userId: user.id, status: 'error', error: String(err) });
    }
  }

  return Response.json({ ran: results.length, results });
}
```

### Pattern 2: vercel.json Cron Configuration

**What:** Add a `"crons"` entry to the existing `vercel.json`. Hobby plans support only once-per-day
cron expressions; Pro supports per-minute.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Note:** The timezone is always UTC on Vercel. `0 6 * * *` fires at 06:00 UTC daily, which is
a reasonable default covering early-morning US timezones.

### Pattern 3: syncLog DB Table + Upsert

**What:** A `syncLog` table tracks the latest sync status per user. Using `onConflictDoUpdate` on
the `userId` unique key means each cron run updates the same row rather than growing the table
unboundedly.

```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
// lib/db/schema.ts — new table
export const syncLog = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  lastSyncStatus: text('last_sync_status', { enum: ['success', 'error'] }),
  lastSyncError: text('last_sync_error'),
});

// Upsert pattern
await db
  .insert(syncLog)
  .values({ userId, lastSyncedAt: new Date(), lastSyncStatus: status, lastSyncError: error ?? null })
  .onConflictDoUpdate({
    target: syncLog.userId,
    set: {
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: error ?? null,
    },
  });
```

### Pattern 4: `/api/sync/last` Endpoint for Dashboard

**What:** A lightweight GET endpoint the dashboard calls on mount to hydrate the "Last synced"
timestamp from DB instead of `localStorage`. Manual syncs should also write to this table on
completion so CRON-02 is satisfied by a single read path.

```typescript
// app/api/sync/last/route.ts
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const log = await db.query.syncLog.findFirst({
    where: eq(syncLog.userId, session.userId),
  });

  return Response.json({
    lastSyncedAt: log?.lastSyncedAt ?? null,
    lastSyncStatus: log?.lastSyncStatus ?? null,
  });
}
```

### Pattern 5: CountdownPanel — Client-Only Timezone Bucketing

**What:** A `'use client'` component that receives the already-fetched course events (or fetches
them itself) and buckets them into Overdue / Due Today / Due Tomorrow / Due This Week using
`new Date()` comparisons in the browser. Never render time-relative strings server-side.

**Why client-only:** `new Date()` on the server runs in UTC; the user's browser may be UTC-5.
This causes React hydration mismatches for any non-UTC user. Marking the component `'use client'`
and using `useEffect` or conditional rendering after mount prevents this. STATE.md already
documents this decision explicitly.

```typescript
// Source: https://nextjs.org/docs/messages/react-hydration-error
// components/CountdownPanel.tsx
'use client';

import { useMemo } from 'react';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later';

function getBucket(dueDate: Date): Bucket {
  const now = new Date();
  // Compare calendar days in local timezone using date-parts (not UTC)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due   = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0)  return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7)  return 'this_week';
  return 'later';
}
```

### Pattern 6: Extracting `runSyncForUser` from the Manual Sync Route

The existing `runSyncJob` in `/api/sync/route.ts` is tightly coupled to the in-memory `syncJobs`
Map and a `jobId`. For the cron route, extract the core logic (parse → filter → colorAssign →
syncCanvas → mirrorSchool) into a standalone `runSyncForUser(userId: number, canvasIcsUrl: string)`
function importable by both routes. This avoids duplicating the 5-step sync pipeline.

### Anti-Patterns to Avoid

- **Calling `getSession()` in the cron route:** Cron invocations have no browser cookie. Always
  use `CRON_SECRET` header auth in cron routes and fetch user data directly from DB.
- **Aborting the loop on first error:** Wrap each user's sync in `try/catch` and `continue`. A
  broken OAuth token for one user must not prevent other users from syncing (CRON-03).
- **Reading `lastSyncedAt` from `localStorage` after this phase:** `localStorage` is invisible to
  cron runs. After this phase, all paths (manual + cron) write to `syncLog`; the dashboard reads
  from `/api/sync/last`. Remove the `localStorage` read from `SyncDashboard`.
- **Server-rendering time-relative strings in CountdownPanel:** Any string like "Due Today" or
  "Overdue" that depends on `new Date()` must be computed client-side only to avoid hydration
  errors (especially for users outside UTC).
- **Accumulating syncLog rows unboundedly:** Use `onConflictDoUpdate` keyed on `userId` — one row
  per user, updated in place. Avoid inserting a new row per run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom background worker, GitHub Actions webhook | Vercel Cron Jobs via `vercel.json` | Zero infrastructure; free on all plans; fires GET at `/api/cron/sync` |
| Cron auth | Custom HMAC signature scheme | `CRON_SECRET` env var + `Authorization: Bearer` header check | Vercel injects the header automatically; standard pattern documented officially |
| DB upsert | Manual SELECT + INSERT/UPDATE | Drizzle `onConflictDoUpdate` | One SQL statement; atomic; already used in `eventTitleCache` in this codebase |
| Timezone date math | Moment.js / luxon | Native `Date` constructor with local year/month/date parts | 4 buckets = ~10 lines; no dependency risk |

**Key insight:** All four requirement areas (cron dispatch, cron auth, DB persistence, timezone
bucketing) have straightforward solutions using existing project dependencies or zero-dependency
platform features. The engineering complexity is in the wiring, not in choosing libraries.

---

## Common Pitfalls

### Pitfall 1: `getSession()` Called from Cron Route

**What goes wrong:** `getSession()` reads a cookie from the request. Vercel cron invocations have
no cookie header, so `getSession()` returns `null` and the cron immediately fails auth.

**Why it happens:** Developers reuse the same auth guard from user-facing routes.

**How to avoid:** Cron routes use `CRON_SECRET` header auth exclusively. Never call `getSession()`
in `/api/cron/*`. Fetch users directly: `await db.select().from(users)`.

**Warning signs:** Cron logs show 401 or null session on every invocation.

### Pitfall 2: Unhandled Promise Rejection Aborts the User Loop

**What goes wrong:** If any `await` inside the per-user loop throws and is not caught, the entire
cron invocation fails. Users after the failing user never get synced (violates CRON-03).

**Why it happens:** Forgetting `try/catch` around the per-user block, or re-throwing inside it.

**How to avoid:** Wrap the entire per-user block in `try/catch`. Log the error to `syncLog` with
`status: 'error'` and `continue` to next user. Never re-throw inside the loop.

**Warning signs:** Cron runs that succeed for the first N users and silently skip the rest.

### Pitfall 3: React Hydration Mismatch from Server-Side `new Date()`

**What goes wrong:** `new Date()` on the server is UTC. A user in UTC-5 sees "Due Today" rendered
server-side that disagrees with the browser's computation, causing React hydration errors.

**Why it happens:** Placing date bucketing logic in a Server Component or in initial render of a
Client Component before `useEffect` fires.

**How to avoid:** Mark `CountdownPanel` as `'use client'`. Perform all `new Date()` comparisons
inside `useMemo` or `useEffect` (both run client-side only). Use `useState` initialized to `null`
server-side and populate in `useEffect` for the timestamp display.

**Warning signs:** Next.js hydration warning in browser console; counts differ between server HTML
and client React tree.

### Pitfall 4: syncLog Growing Unboundedly

**What goes wrong:** If `INSERT INTO sync_log` is used without `ON CONFLICT DO UPDATE`, every cron
run adds a new row per user. After 365 days with 10 users = 3,650 rows with no unique value.

**How to avoid:** Add a `UNIQUE` constraint on `syncLog.userId` and use `onConflictDoUpdate`.
The codebase already uses `onConflictDoNothing` in `eventTitleCache`; use `onConflictDoUpdate`
here because we want to overwrite the previous status.

### Pitfall 5: Hobby Plan Cron Frequency Limit

**What goes wrong:** A cron expression like `0 */6 * * *` (every 6 hours) causes deployment to
fail with "Hobby accounts are limited to daily cron jobs."

**How to avoid:** Use `0 6 * * *` or any once-per-day expression. For the daily sync use case
this is not a limitation — once per day is the stated requirement.

**Warning signs:** `vercel deploy` fails with cron expression validation error.

### Pitfall 6: `maxDuration` Default Too Short for Multi-User Sync

**What goes wrong:** With 10+ users, syncing all Canvas feeds + GCal writes easily exceeds the
15-second default `maxDuration` for Pro plan functions.

**How to avoid:** Export `export const maxDuration = 300;` from the cron route file. This sets
the 300-second (5-minute) cap available on Pro. For Hobby, the maximum is 60 seconds — document
this as a known constraint.

**Warning signs:** Vercel function timeout errors in cron logs; partial user sync.

### Pitfall 7: In-Memory `syncJobs` Map Cannot Be Used for Cron Results

**What goes wrong:** The existing `syncJobs` Map in `/api/sync/route.ts` is in-memory and
instance-local. A cron invocation runs on a different serverless function instance than the one
the user's browser polls. The dashboard will never see cron results from the in-memory map.

**How to avoid:** Cron results go to `syncLog` DB only. The dashboard reads from
`/api/sync/last` (DB-backed), not from `/api/sync/status?jobId=...` (in-memory Map).

---

## Code Examples

### Verified: Vercel Cron Config in vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```
Source: https://vercel.com/docs/cron-jobs/quickstart

### Verified: CRON_SECRET Auth Pattern

```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... cron logic
}
```

### Verified: Drizzle Upsert with onConflictDoUpdate

```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
await db
  .insert(syncLog)
  .values({ userId, lastSyncedAt: new Date(), lastSyncStatus: 'success' })
  .onConflictDoUpdate({
    target: syncLog.userId,
    set: {
      lastSyncedAt: new Date(),
      lastSyncStatus: 'success',
      lastSyncError: null,
    },
  });
```

### Verified: Per-User Error Isolation Loop

```typescript
// Pattern from STATE.md locked decision + CRON-03 requirement
for (const user of allUsers) {
  try {
    await runSyncForUser(user.id, user.canvasIcsUrl);
    await upsertSyncLog(user.id, 'success', null);
  } catch (err) {
    // Record failure but CONTINUE — do not re-throw
    await upsertSyncLog(user.id, 'error', classifyError(err));
  }
}
```

### Verified: Client-Only Date Bucketing (hydration-safe)

```typescript
// Source: https://nextjs.org/docs/messages/react-hydration-error
'use client';
import { useState, useEffect } from 'react';

export function CountdownPanel({ events }: { events: CanvasEvent[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null; // suppress server render entirely

  // All date logic runs in browser only — timezone-correct
  const bucketed = bucketByDeadline(events);
  return <>{/* render bucketed groups */}</>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `localStorage` for lastSyncedAt | `syncLog` DB table | Phase 5 (this phase) | Cron results visible to dashboard; required by CRON-02 |
| `void runSyncJob(...)` fire-and-forget | `after()` from `next/server` | Phase 3 | Ensures background task completes on Vercel; same pattern applies to cron |
| In-memory `syncJobs` Map for status | DB `syncLog` for cron results | Phase 5 (this phase) | In-memory Map is instance-local; DB is shared across serverless instances |

**Deprecated/outdated for this phase:**
- Reading `lastSyncedAt` from `localStorage`: Replace with `/api/sync/last` fetch on mount.
- `syncJobs.get(jobId)` as the status source for cron runs: Not applicable; cron runs do not
  produce a `jobId`.

---

## Open Questions

1. **Manual sync still writes to `localStorage` — should it also write to `syncLog`?**
   - What we know: CRON-02 requires the dashboard to read from DB after cron runs. The manual sync
     currently writes only to `localStorage`.
   - What's unclear: Whether to make manual sync also write to `syncLog` (single read path) or
     keep both read sources active (more complex).
   - Recommendation: Make the manual sync's POST completion handler also call `upsertSyncLog` so
     the dashboard has a single `GET /api/sync/last` read path. This simplifies SyncDashboard and
     removes the `localStorage` dependency entirely.

2. **What does CountdownPanel show when Canvas feed is not yet loaded?**
   - What we know: Events come from `/api/parse-ics`. If the user has no Canvas URL, the courses
     array is empty.
   - Recommendation: Show an empty state ("No upcoming Canvas deadlines") rather than a loading
     spinner. The panel can receive events as a prop from SyncDashboard (already fetched).

3. **syncToken incremental sync (mentioned in STATE.md blockers) — is it a Phase 5 prerequisite?**
   - STATE.md notes: "syncToken incremental sync required before enabling multi-user cron loop —
     prevents GCal per-minute quota exhaustion at 10+ users."
   - What's unclear: Whether the current user count is low enough that full-list sync is
     acceptable for Phase 5 launch, or whether syncToken must be implemented first.
   - Recommendation: Document as a known constraint. For < 10 users, full-list sync is acceptable.
     Add a note in the plan to gate the cron on users with `canvasIcsUrl IS NOT NULL` to skip
     unset-up accounts. Track syncToken implementation as a follow-up if user count grows.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --testPathPattern="cron\|syncLog\|countdown" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CRON-01 | Cron route calls `runSyncForUser` for each user in DB | unit | `npx jest src/app/api/cron --no-coverage` | Wave 0 |
| CRON-01 | Cron route returns 401 when `Authorization` header is missing or wrong | unit | `npx jest src/app/api/cron --no-coverage` | Wave 0 |
| CRON-02 | `upsertSyncLog` writes `lastSyncedAt` and `status` to DB | unit | `npx jest src/app/api/cron --no-coverage` | Wave 0 |
| CRON-02 | `GET /api/sync/last` returns DB row values | unit | `npx jest src/app/api/sync/last --no-coverage` | Wave 0 |
| CRON-03 | One user throwing inside loop does not prevent subsequent users from running | unit | `npx jest src/app/api/cron --no-coverage` | Wave 0 |
| CRON-03 | Failed user has `status: 'error'` in `syncLog`; successful user has `status: 'success'` | unit | `npx jest src/app/api/cron --no-coverage` | Wave 0 |
| COUNTDOWN-01 | `getBucket` returns `'overdue'` for dates before today | unit | `npx jest src/components/CountdownPanel --no-coverage` | Wave 0 |
| COUNTDOWN-01 | `getBucket` returns `'today'` for same calendar day | unit | `npx jest src/components/CountdownPanel --no-coverage` | Wave 0 |
| COUNTDOWN-01 | `getBucket` returns `'tomorrow'` for next calendar day | unit | `npx jest src/components/CountdownPanel --no-coverage` | Wave 0 |
| COUNTDOWN-01 | `getBucket` returns `'this_week'` for 2–7 days ahead | unit | `npx jest src/components/CountdownPanel --no-coverage` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="cron\|syncLog\|countdown\|classifyError" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/cron/sync/__tests__/cronSync.test.ts` — covers CRON-01, CRON-02, CRON-03
- [ ] `src/app/api/sync/last/__tests__/syncLast.test.ts` — covers CRON-02 GET endpoint
- [ ] `src/components/__tests__/CountdownPanel.test.tsx` — covers COUNTDOWN-01 `getBucket` logic

*(All existing 15 test files cover pre-Phase-5 functionality and require no modification.)*

---

## Sources

### Primary (HIGH confidence)

- https://vercel.com/docs/cron-jobs — Cron job concepts, cron expression format, UTC timezone note
- https://vercel.com/docs/cron-jobs/quickstart — `vercel.json` `"crons"` array format (verified via WebFetch)
- https://vercel.com/docs/cron-jobs/manage-cron-jobs — `CRON_SECRET` auth pattern, `maxDuration`, concurrency control, idempotency guidance (verified via WebFetch)
- https://vercel.com/docs/cron-jobs/usage-and-pricing — Hobby: once/day, ±59 min precision; Pro: once/min; 100 crons per project (verified via WebFetch)
- https://orm.drizzle.team/docs/guides/upsert — `onConflictDoUpdate` pattern
- https://nextjs.org/docs/messages/react-hydration-error — `'use client'` + `useEffect` pattern for timezone-safe rendering

### Secondary (MEDIUM confidence)

- STATE.md Accumulated Decisions — locked decisions for cron route auth, per-user try/catch, syncLog migration, CountdownPanel client-only rendering (project-internal, cross-referenced with requirements)

### Tertiary (LOW confidence)

- None — all key claims verified with official sources or project files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies cover everything; no new packages
- Architecture patterns: HIGH — Vercel official docs verified; Drizzle upsert documented
- Pitfalls: HIGH — most pitfalls derived from STATE.md locked decisions + Vercel official docs
- Countdown bucketing: HIGH — pure `Date` logic; no library risk; pattern is self-evident

**Research date:** 2026-03-16
**Valid until:** 2026-06-01 (Vercel Cron API is stable; Drizzle API is stable at 0.x)

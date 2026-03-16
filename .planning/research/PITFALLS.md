# Pitfalls Research

**Domain:** Canvas-to-Google-Calendar sync app — v1.1 milestone additions (auto-sync cron, deadline countdown, dedup dashboard, conflict resolution)
**Researched:** 2026-03-16
**Confidence:** HIGH (verified against official Vercel docs, Next.js docs, Google Calendar API docs, and direct codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: Cron Route Uses `after()` — Background Work Is Still Bounded by `maxDuration`

**What goes wrong:**
The current manual sync uses `after(runSyncJob(...))` to run sync after the HTTP response returns, which is correct for keeping the UI responsive. When you add a cron route that calls `after()` for the per-user sync loop, the background work still runs within the same function invocation's `maxDuration` budget. On Vercel Hobby with Fluid Compute enabled the default is 300 seconds (5 minutes). Without Fluid Compute (older config or if explicitly disabled) the Hobby default is 10 seconds and the maximum is 60 seconds. A cron that syncs 20 users sequentially — each taking 5–30 seconds — will be killed mid-run with no error surfaced to users.

**Why it happens:**
`after()` does not extend the deadline beyond `maxDuration`. It only defers execution until after the HTTP response is sent. The function invocation still terminates at `maxDuration`. Developers see manual sync working (single-user, short-lived) and assume the same pattern works at scale for cron.

**How to avoid:**
Set `export const maxDuration = 300` explicitly on the cron route file (the plan-maximum for Hobby with Fluid Compute). Verify Fluid Compute is not disabled in the Vercel project settings. For cron specifically, do NOT rely on `after()` — the cron endpoint already has no user waiting for a response, so there is no benefit. Run the sync loop directly and return 200 only after all users complete (or after a per-user timeout with logged failures). If total time exceeds 300 seconds, process users in batches — store a cursor in the database and fan out across multiple cron triggers.

**Warning signs:**
- Cron run starts, processes a few users, and then all remaining users show no sync activity
- Vercel function logs show 504 or timeout for cron invocations but no error in the app
- The 5-minute cron window passes but only some users' calendars are updated

**Phase to address:**
Auto-sync cron phase — set `maxDuration` and choose sequential-vs-parallel strategy before writing the user loop.

---

### Pitfall 2: One User's Token Refresh Failure Kills the Entire Cron Run

**What goes wrong:**
The current `getFreshAccessToken()` returns `null` when refresh fails, but `syncCanvasEvents()` throws if the token is null. If the cron iterates users with `for...of` and one user's token refresh throws or causes the sync to throw, the entire cron function errors out and all subsequent users are skipped. Users after the failing user get no sync that day, with no notification.

**Why it happens:**
The manual sync only touches one user, so a thrown error only affects that user. In a multi-user loop, the same throw propagates up and kills the loop. Developers test with one or two good-token accounts and miss the per-user error isolation requirement.

**How to avoid:**
Wrap each user's sync in an independent try/catch inside the cron loop. Store per-user sync results (success / failure / token-expired) in the database so failures are queryable. Log each failure with the userId and reason, then continue to the next user. The cron function itself should return 200 as long as it completed the loop — a non-2xx status tells nothing useful about per-user failures and just confuses Vercel's cron logs.

```typescript
// Pattern: per-user try/catch with DB result storage
for (const user of users) {
  try {
    await syncUser(user.id);
    await db.update(users).set({ lastSyncAt: new Date(), lastSyncStatus: 'ok' })
      .where(eq(users.id, user.id));
  } catch (err) {
    await db.update(users).set({ lastSyncStatus: 'error', lastSyncError: String(err) })
      .where(eq(users.id, user.id));
    // continue — do not rethrow
  }
}
```

**Warning signs:**
- Cron logs show a single error and then no further activity for that run
- User A's calendar updates but Users B, C, D never sync despite having valid tokens
- No per-user last-sync timestamp in DB, so there is no way to know who was skipped

**Phase to address:**
Auto-sync cron phase — design per-user error isolation before writing the user loop.

---

### Pitfall 3: Google Calendar API Per-User-Per-Minute Quota Exhausted When Multiple Users Sync Simultaneously

**What goes wrong:**
The Google Calendar API enforces quotas at two levels: per-project-per-minute (shared across all users of the app) and per-user-per-minute (per individual Google account). If the cron triggers all users' syncs in parallel (or even sequentially without delay), the per-project quota is shared. The existing `gcalSync.ts` makes roughly 1 `events.list` + N `events.insert/update` calls per type-subcalendar per course. For 10 users each with 5 courses × 4 types = 20 subcalendars = 20 `events.list` calls + 50 event writes = 70 calls per user = 700 calls in a single cron run. On Hobby, if those 700 calls hit within 60 seconds, the per-minute project quota will be breached and all remaining calls return 429/403.

**Why it happens:**
The v1.0 implementation was designed for single-user manual sync. The per-project quota was not a concern with one user. Adding more users without rate-limiting the loop multiplies the call volume proportionally.

**How to avoid:**
Process users sequentially, not in parallel, for the initial multi-user cron. Add exponential backoff with jitter on 429 responses using the `Retry-After` header from Google's response. Use incremental sync via Google Calendar's `syncToken` mechanism — after the first full sync, store the `nextSyncToken` per subcalendar in the database; subsequent runs call `events.list?syncToken=...` which returns only changed events (typically 0–5 instead of 50–200). This reduces call volume by 90%+ after the first run.

**Warning signs:**
- `403 usageLimits` or `429 rateLimitExceeded` errors appearing in sync logs
- Only the first 2–3 users sync successfully before the rest fail with quota errors
- Errors are transient (retry next day works) — this is the signature of per-minute exhaustion, not auth failure

**Phase to address:**
Auto-sync cron phase — implement incremental sync (`syncToken`) before enabling multi-user cron. Rate-limiting the loop is not sufficient without it.

---

### Pitfall 4: In-Memory `syncJobs` Map Is Useless for Cron-Triggered Syncs

**What goes wrong:**
The cron endpoint will trigger sync for all users. Each user's sync runs inside the same serverless function invocation. The `syncJobs` Map in `src/app/api/sync/route.ts` is in-process memory local to that invocation. The status polling endpoint (`GET /api/sync/status`) reaches a different serverless invocation with a different in-memory Map. When users load the dashboard after a cron run to see results, polling returns 404 ("job not found") because the cron invocation's memory is gone.

**Why it happens:**
In-memory job state is acceptable for manual sync because the user's browser and the API invocation share the same brief window. The cron runs in a separate invocation with no user actively polling — and no guarantee the invocation is the same one that would serve the user's next HTTP request.

**How to avoid:**
For cron sync results, write the outcome to the database (per-user `lastSyncAt`, `lastSyncStatus`, `lastSyncSummary` columns on the `users` table). The dashboard reads sync status from the database, not from the in-memory job map. The existing `syncJobs` Map can remain for the interactive manual sync flow, but cron should not use it. These are two separate code paths.

**Warning signs:**
- Users see "no sync results" on dashboard after cron runs
- Polling after a cron returns 404 for all job IDs
- Manual sync works fine but cron results are never surfaced

**Phase to address:**
Auto-sync cron phase — decide on DB-backed status before implementing the cron user loop.

---

### Pitfall 5: Deadline Countdown Shows Wrong Time Due to Server-Side Date Rendering

**What goes wrong:**
If the deadline countdown component renders a date string server-side (e.g., "Due in 3 hours 22 minutes"), the server renders using UTC or the server's timezone. The client hydrates with the user's local timezone. The hydrated text differs from the server-rendered text, causing a React hydration mismatch error in the console and potentially a flicker or doubled render in the UI. The "due in X" value becomes wrong for any user not in the server's timezone.

**Why it happens:**
Canvas ICS events store dates as UTC. `new Date(event.start)` on the server produces an instant correct in absolute time, but formatting it as "days/hours remaining" requires the user's local timezone to be meaningful. The server does not know the user's timezone unless it is explicitly sent.

**How to avoid:**
Render the deadline countdown entirely client-side. Use a `useEffect` to initialize the countdown only after mount, setting a `mounted` state flag to prevent rendering until the client has its own timezone context. Alternatively, pass the raw ISO timestamp as a `data-` attribute and hydrate it on the client. Do not render time-remaining strings in Server Components or server-side `getServerSideProps`-equivalent without timezone knowledge.

```typescript
// Pattern: client-only countdown
const [timeLeft, setTimeLeft] = useState<string | null>(null);
useEffect(() => {
  setTimeLeft(formatTimeUntil(event.start)); // runs only on client
  const id = setInterval(() => setTimeLeft(formatTimeUntil(event.start)), 60_000);
  return () => clearInterval(id);
}, [event.start]);

if (!timeLeft) return <span>Loading...</span>; // avoids hydration mismatch
```

**Warning signs:**
- React hydration errors in browser console mentioning time strings
- Countdown shows negative values or "expired" for future events on first load
- Users in non-UTC timezones report wrong due dates

**Phase to address:**
Deadline countdown phase — make the countdown a pure client component from the start.

---

### Pitfall 6: Deadline Countdown Data Goes Stale — No Re-Fetch After Background Cron Sync

**What goes wrong:**
The user loads the dashboard, sees a countdown for upcoming deadlines from the last manual sync. The cron runs in the background and adds new events (a new assignment was posted to Canvas). The user's browser still shows the old data. The countdown lists do not update unless the page is reloaded. Users see "5 upcoming deadlines" when there are actually 7.

**Why it happens:**
Server Components fetch once at request time. There is no websocket or push mechanism. After a cron sync, the DB has fresh data but the browser has no way to know. Users who visit the page between cron runs see outdated countdown data.

**How to avoid:**
Add a `lastSyncAt` timestamp from the database to the dashboard. If `lastSyncAt` is newer than the page load time (detectable via a short polling interval or on-focus refetch), prompt the user to refresh or auto-revalidate using `router.refresh()`. Use `revalidatePath('/dashboard')` or Next.js on-demand revalidation from the cron endpoint after completing all user syncs to invalidate the page cache. Alternatively, fetch the countdown data client-side (not as a Server Component) so a simple interval refetch keeps it fresh.

**Warning signs:**
- User adds a new Canvas assignment, cron syncs, but dashboard still shows old count
- "Next deadline" shows a past date (the cron synced and created new closer deadlines)
- Users must manually reload to see changes from cron sync

**Phase to address:**
Deadline countdown phase — decide on freshness strategy (polling, revalidation, or on-focus refetch) before implementing the countdown UI.

---

### Pitfall 7: Dedup/Conflict Dashboard Shows Stale State — Fetch Happens at Page Load, Sync Runs Async

**What goes wrong:**
The dedup dashboard compares "what's in GCal now" against "what the current Canvas feed contains." If the user opens the dashboard, then manually or automatically syncs, the dashboard still reflects pre-sync GCal state. The diff shows events as "would be added" that were just added. More critically, if a user acts on a conflict resolution (clicks "keep Canvas version"), the UI optimistically removes the item, but the next page load re-fetches and shows it again as a conflict if the sync has not actually run yet.

**Why it happens:**
Pulling GCal state is expensive (requires live API calls per subcalendar). The dashboard caches the result at render time. Sync runs asynchronously. The cached state and the sync are decoupled with no coordination signal.

**How to avoid:**
Include a `syncedAt` timestamp on the dashboard's data fetch. After any sync completes (manual or cron), invalidate the dedup view cache. Store conflict resolution decisions in the database (a `userResolutions` table mapping Canvas UID to "user chose X") so they persist across page loads. Never derive conflict state purely from a one-time API call — store a materialized snapshot updated at sync time and compare against it.

**Warning signs:**
- "Items to add" count resets to stale numbers on every page load
- User resolves a conflict, refreshes, sees the same conflict again
- Dedup list shows events the user already knows are synced

**Phase to address:**
Dedup/conflict UI phase — design the data model (where is the "known synced state" stored?) before building any UI. The answer must be the database, not live GCal API calls per page load.

---

### Pitfall 8: Dedup Dashboard Performance — `events.list` Per Subcalendar Is Too Slow for UI

**What goes wrong:**
The dedup dashboard needs to show "what's already in GCal." The existing sync code calls `calendar.events.list()` once per (course, type) subcalendar. A student with 5 courses × 4 types = 20 subcalendars requires 20 API calls to build the dedup view. Each call takes 200–500ms. Total: 4–10 seconds to render the dashboard. This is unacceptable for a UI page load.

**Why it happens:**
The existing `gcalSync.ts` bulk-fetch pattern was designed for sync (where latency is acceptable). Reusing it directly for a dashboard that the user expects to be fast leads to a slow, frustrating UI.

**How to avoid:**
Do not call the GCal API live on dashboard page loads. Instead, maintain a `syncedEvents` table in Neon Postgres that mirrors the Canvas UIDs of successfully synced events (written at sync time, not at view time). The dedup dashboard reads from this local table — zero GCal API calls required. The dedup view is then always fast (a single DB query) and does not count against the GCal quota.

**Warning signs:**
- Dashboard takes 5+ seconds to load
- GCal API quota is consumed on every user page view, not just sync
- Dashboard is slow for users with many courses

**Phase to address:**
Dedup/conflict UI phase — add a `syncedEvents` mirror table before writing the dashboard query.

---

### Pitfall 9: Vercel Cron Cannot Use Session-Based Auth — Cron Route Must Have Different Auth Model

**What goes wrong:**
All existing API routes authenticate via `getSession()` which reads the session cookie from `req.headers`. A cron invocation from Vercel has no browser session cookie — it is an unauthenticated HTTP GET from Vercel's infrastructure. If the cron route calls `getSession()`, it will return null and the route will return 401 Unauthorized, silently failing every day.

**Why it happens:**
The existing pattern for all API routes is session-based. Developers add the cron handler and copy the auth guard from an existing route without noticing the cron invocation has no cookie.

**How to avoid:**
The cron endpoint must authenticate via the `CRON_SECRET` header, not the session cookie. Check `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\`` at the top of the cron handler. Do not call `getSession()` in the cron route. Internally, after validating `CRON_SECRET`, query all users from the database directly (no session required — the cron acts as a system process, not a user-session process).

**Warning signs:**
- Cron appears in Vercel dashboard but logs show 401 on every invocation
- No sync activity even though cron fires (check Vercel cron logs, not app logs)
- Adding a console.log at the top of the cron handler confirms the function is never reached

**Phase to address:**
Auto-sync cron phase — auth model is the very first thing to implement in the cron route.

---

### Pitfall 10: Canvas ICS Feed Re-Fetched Per-User in Cron — No Deduplication Across Users

**What goes wrong:**
If two students share the same Canvas course, they likely have the same or very similar ICS feed content (or even the same URL). The cron fetches each user's ICS feed independently. For N users, the ICS feed is fetched N times. Canvas ICS feeds are not slow individually (~500ms) but accumulate: 20 users × 500ms = 10 seconds just in feed fetches, before any GCal calls. More importantly, the AI classifier (`classifyEventsWithCache`) is called per user — but the event-name-to-type cache in the `classifierCache` DB table is shared. This is good. However, each user still fetches their own feed, which causes the classification to re-run on the same event names N times before the cache warms up on the first cron run.

**Why it happens:**
The current `parseCanvasFeed` fetches and classifies as one operation. There is no shared feed cache across users, only a shared classifier cache.

**How to avoid:**
The classifier cache handles the classification redundancy correctly — this is already implemented. The ICS fetch itself cannot be shared (different users have different URLs). Accept the per-user fetch cost (it is bounded by N users × ~500ms). The real mitigation is rate-limiting within the cron loop: process users with a concurrency cap (e.g., 3 at a time) rather than serially (too slow) or fully parallel (quota exhaustion).

**Warning signs:**
- Cron runtime scales linearly with user count, suggesting sequential fetch bottleneck
- `classifierCache` DB is empty before first cron run (this is expected — it warms up after first run)

**Phase to address:**
Auto-sync cron phase — acceptable to process sequentially in MVP, but document the scaling ceiling.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full ICS re-fetch every cron run (no feed caching) | Simple; no cache invalidation logic | N fetches per cron run; Canvas could throttle if ICS URL is hit repeatedly | MVP with few users; replace with caching if Canvas returns 429 |
| Full GCal sync every cron run (no `syncToken`) | No token storage or 410 handling | 20+ API calls per user per day; quota exhaustion with >5 users | MVP with 1–3 users only; replace with incremental sync before opening to many users |
| Sequential user processing in cron | Simple; easy error isolation | Cron runtime grows with user count; max ~50–60 users before hitting 300s timeout | MVP; add controlled concurrency (p-queue, concurrency=3) when user count grows |
| Reading dedup state from live GCal API calls | Always fresh | 200–5000ms per page load; quota consumed on views not syncs | Never for dashboard; use DB mirror table from day one |
| Storing countdown state in Server Component | Simplest rendering path | Hydration mismatch for non-UTC users; stale after background sync | Never; countdown must be client-rendered |
| In-memory `syncJobs` Map reused for cron result storage | No code changes needed | Cron result is in a different invocation's memory; dashboard shows 404 | Never for cron; only for interactive manual sync |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel Cron | Using `getSession()` in cron route handler | Check `Authorization: Bearer ${CRON_SECRET}` header; no session cookie in cron invocations |
| Vercel Cron | Relying on `after()` to extend execution past `maxDuration` | `after()` does not extend the deadline; set `export const maxDuration = 300` explicitly on the cron route |
| Vercel Cron | Returning non-2xx when any one user fails | Return 200 after iterating all users; per-user failures go to DB, not HTTP status |
| Google Calendar API | Calling `events.list` per subcalendar on every dashboard load | Maintain a `syncedEvents` DB mirror; only call GCal API during sync, not on page views |
| Google Calendar API | No exponential backoff on 429 in cron user loop | Catch 429, wait `Retry-After` seconds, then retry; log the delay for observability |
| Google Calendar API | Parallel sync for all users hitting per-project quota | Cap concurrency at 3 users in parallel; use `p-queue` or similar |
| Canvas ICS feed | No `maxDuration` set on cron route | A 5-user sync can take 60+ seconds; without explicit `maxDuration = 300`, the Vercel default (10s without Fluid Compute) kills the run |
| Next.js `after()` | Using `after()` inside cron route to defer the user loop | The cron function returns immediately, but the after() work is orphaned when the function reaches maxDuration; run the user loop directly |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full GCal sync per user per cron run | 20+ API calls/user/day; quota at ~5 users | Implement `syncToken` incremental sync | 5+ active users with 5+ courses each |
| Dashboard reads GCal API live | 5–10s page load; quota consumed on views | Materialized `syncedEvents` DB table | Any user with more than 3 courses |
| Sequential cron user loop with no timeout per user | One slow user (flaky Canvas URL) blocks all subsequent users | Per-user timeout (`Promise.race` with 30s timeout); continue loop regardless | Any user whose Canvas feed takes >30s |
| Countdown rendered server-side | Hydration errors; wrong timezone for non-UTC users | Client-only countdown with `useEffect` | Every non-UTC user on first load |
| No `lastSyncAt` DB column | Cannot show "last synced X minutes ago"; cannot detect stale state | Add `lastSyncAt` and `lastSyncStatus` to `users` table before cron | First cron run |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cron route with no `CRON_SECRET` check | Any actor who discovers the URL can trigger sync for all users, exhausting quota | Add `CRON_SECRET` check as the first line of the cron handler |
| Logging user tokens in cron error output | Token values appear in Vercel function logs accessible to any project member | Log only userId and error type, never token strings |
| Cron response body includes per-user error details | Sensitive user data (email, token status) visible in Vercel cron logs | Return aggregate counts only; per-user detail stays in DB |
| Dedup dashboard shows event data from other users | Incorrect DB query without userId filter exposes cross-user events | All dedup queries must filter by `userId`; integration-test with two accounts |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "last synced" timestamp on dashboard | User cannot tell if auto-sync is working | Show "Last synced: 3 hours ago" from `users.lastSyncAt` DB column |
| Cron failure invisible to user | Calendar goes stale; user misses deadline | Surface `lastSyncStatus = 'error'` as a banner: "Auto-sync failed — reconnect your account" |
| Countdown shows server timezone instead of user timezone | "Due in 2 hours" is actually "due in 9 hours" for PST users | Client-only countdown; no server-side time-remaining strings |
| Dedup dashboard refreshes count on every visit | User sees numbers change without sync running | Store dedup state in DB at sync time; count is stable between syncs |
| Conflict resolution not persisted — user decides, refreshes, decision is gone | Re-review same conflicts every visit | Store resolution in `userResolutions` table keyed on Canvas UID |
| Token expiry surfaced as generic sync error during auto-sync | User sees "sync failed" with no actionable next step | Detect `invalid_grant` in cron loop; set `tokenStatus = 'expired'` on user row; UI shows "Reconnect account" CTA |

---

## "Looks Done But Isn't" Checklist

- [ ] **Cron endpoint:** Appears in Vercel dashboard — verify it actually executes by checking runtime logs; confirm `CRON_SECRET` check is present; confirm a 401 is returned when no auth header is sent
- [ ] **Cron error isolation:** Cron completes — verify with two users where one has an expired token; confirm the second user still syncs despite the first failing
- [ ] **`maxDuration` set:** Cron route file exists — verify `export const maxDuration = 300` is present in the cron route file; without it, Hobby plan uses 10s default (or 300s with Fluid Compute — check project settings)
- [ ] **Cron result in DB:** Sync runs after cron — verify `users.lastSyncAt` is updated; verify dashboard shows updated timestamp without a manual sync
- [ ] **Deadline countdown timezone:** Countdown renders — verify a user in PST sees a deadline at 11:59 PM Pacific, not 11:59 PM UTC (7 hours off)
- [ ] **Countdown no hydration error:** Countdown component loads — check browser console for React hydration warnings mentioning time strings
- [ ] **Dedup dashboard performance:** Dashboard loads — time it with browser DevTools; more than 2 seconds means live GCal API calls are being made instead of the DB mirror
- [ ] **Dedup state persists:** User resolves a conflict, reloads — resolution should not reappear; if it does, resolution is not being written to DB
- [ ] **Quota under multi-user cron:** Cron runs for 5 users — verify no 429 errors in logs; if present, sequential processing or `syncToken` incremental sync is needed
- [ ] **`syncToken` 410 handling:** App has used incremental sync at least once — verify code has a `try/catch` that detects `410 Gone`, discards the token, and falls back to a full sync

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cron killed mid-run (no `maxDuration`) | LOW | Add `export const maxDuration = 300` to cron route; deploy; verify next run completes |
| All users skipped after first user token failure | LOW | Add per-user try/catch; deploy; next cron run processes all users |
| Quota exhausted from parallel cron sync | LOW | Switch to sequential processing; optionally add `syncToken`; deploy; next day's cron will succeed |
| Dedup dashboard slow (live GCal calls) | MEDIUM | Add `syncedEvents` DB table; backfill from next sync run; update dashboard query |
| Countdown hydration errors for all non-UTC users | LOW | Move countdown to client component with `useEffect`; zero data migration needed |
| Conflict resolutions lost on page reload | LOW | Add `userResolutions` DB table; all existing resolutions are gone (user must redo); small number expected |
| `syncToken` returns 410 | LOW | Detected in catch block; discard token in DB; next sync is a full re-sync; subsequent syncs use new token |
| Cron results never appear on dashboard (in-memory Map issue) | MEDIUM | Add `lastSyncAt`/`lastSyncStatus` columns to `users` table; update cron loop to write results; update dashboard to read from DB |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `after()` does not extend `maxDuration`; cron killed mid-run | Auto-sync cron phase | Add `export const maxDuration = 300`; integration test with 10-user loop confirms full completion |
| One user failure kills entire cron loop | Auto-sync cron phase | Test with one expired-token user in pool; confirm subsequent users still sync |
| GCal per-project quota exhaustion | Auto-sync cron phase | Implement `syncToken` before enabling multi-user cron; verify API call count in logs |
| In-memory `syncJobs` useless for cron results | Auto-sync cron phase | Add `lastSyncAt`/`lastSyncStatus` DB columns; dashboard reads from DB not memory |
| Cron route rejects its own Vercel invocation (session auth) | Auto-sync cron phase | `CRON_SECRET` check as first line; verify cron actually executes in production logs |
| Countdown timezone hydration mismatch | Deadline countdown phase | Client-only countdown; zero React hydration warnings in browser console for non-UTC user |
| Countdown data stale after background cron sync | Deadline countdown phase | Polling/revalidation strategy chosen; dashboard auto-updates after cron completes |
| Dedup dashboard reads live GCal API | Dedup/conflict UI phase | `syncedEvents` DB table present; page load time under 500ms regardless of course count |
| Dedup state shows stale conflicts after sync | Dedup/conflict UI phase | Dedup view reads from DB mirror updated at sync time; conflicts disappear after sync that resolves them |
| Conflict resolution not persisted | Dedup/conflict UI phase | `userResolutions` table present; user decision survives page reload |
| Canvas ICS re-fetch per user in cron | Auto-sync cron phase | Accepted in MVP; document user count ceiling (~50–60 before 300s limit reached) |
| Token expiry invisible during auto-sync | Auto-sync cron phase | `tokenStatus` column on `users`; UI shows reconnect banner when `tokenStatus = 'expired'` |

---

## Sources

- [Vercel: Configuring Maximum Duration for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration) — Hobby default 300s with Fluid Compute, 10s without; Pro max 800s (HIGH confidence — official docs, verified 2026-03-16)
- [Vercel: Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — no-retry behavior, idempotency, CRON_SECRET, redirect handling, concurrent invocation risk (HIGH confidence — official docs)
- [Vercel: Cron Jobs Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby: once per day, ±59 min precision; Pro: once per minute (HIGH confidence — official docs)
- [Next.js: `after()` API Reference](https://nextjs.org/docs/app/api-reference/functions/after) — runs within route's `maxDuration`; does not extend deadline; uses `waitUntil` internally (HIGH confidence — official docs, version 16.1.6)
- [Google Calendar API: Manage Quotas](https://developers.google.com/workspace/calendar/api/guides/quota) — per-project-per-minute and per-user-per-minute quotas enforced; 1M queries/day project limit (HIGH confidence — official docs)
- [Google Calendar API: Handle Errors](https://developers.google.com/workspace/calendar/api/guides/errors) — 403/429 both indicate quota; use exponential backoff with jitter (HIGH confidence — official docs)
- [Google Calendar API: Synchronize Resources Efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) — `syncToken` incremental sync; 410 means full re-sync required (HIGH confidence — official docs)
- [Google Developers Blog: Calendar API per-minute quota change (2021)](https://developers.googleblog.com/the-google-calendar-api-has-changed-how-we-manage-api-usage/) — traffic spread recommendation; avoid aligned midnight cron for all users (MEDIUM confidence — official blog)
- [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error) — Date.now() and time formatting cause server/client HTML mismatch (HIGH confidence — official docs)
- Direct codebase analysis: `src/app/api/sync/route.ts` — in-memory `syncJobs` Map, `after()` usage, single-user flow (HIGH confidence — source code)
- Direct codebase analysis: `src/lib/tokens.ts` — `getFreshAccessToken()` returns null on failure (not throws); callers that throw on null are the failure point in a loop (HIGH confidence — source code)
- Direct codebase analysis: `src/services/gcalSync.ts` — 1 `events.list` per (course, type) subcalendar; N insert/update calls per event (HIGH confidence — source code)
- Direct codebase analysis: `src/lib/db/schema.ts` — no `lastSyncAt`, `lastSyncStatus`, `syncedEvents`, or `userResolutions` tables currently exist (HIGH confidence — source code)

---
*Pitfalls research for: Canvas-to-GCal v1.1 milestone — auto-sync cron, deadline countdown, dedup dashboard, conflict resolution*
*Researched: 2026-03-16*

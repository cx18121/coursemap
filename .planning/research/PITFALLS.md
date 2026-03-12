# Pitfalls Research

**Domain:** Canvas-to-Google-Calendar sync app (multi-account OAuth, calendar mirroring, serverless scheduled sync)
**Researched:** 2026-03-11
**Confidence:** HIGH (most pitfalls verified against official docs and multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Google OAuth App Stays in "Testing" Mode — Refresh Tokens Expire in 7 Days

**What goes wrong:**
When a Google Cloud project's OAuth consent screen is in "Testing" publishing status, Google automatically invalidates all refresh tokens after 7 days. Users are silently logged out one week after connecting. The error returned is `invalid_grant: Token has been expired or revoked`, and no warning appears in the Google Cloud Console.

**Why it happens:**
Developers build the OAuth flow, test it successfully, and ship without noticing the consent screen is still in the default "Testing" status. Everything appears to work, but a week later the scheduled sync starts failing for all users.

**How to avoid:**
Before deploying to production, go to the Google Cloud Console → OAuth consent screen and change publishing status to "Production". This requires completing the app verification form but removes the 7-day expiry. For internal personal use (single user), you can keep "Testing" mode only if you add the target Google accounts as "Test users" explicitly — the 7-day limit still applies, but at least the failure is predictable.

**Warning signs:**
- Sync succeeds on day 1 and fails on day 8 with no code changes
- `invalid_grant` in error logs exactly 7 days after connecting an account
- Manual re-authentication "fixes" the problem temporarily but recurs

**Phase to address:**
OAuth implementation phase — set publishing status before first real deployment, not after.

---

### Pitfall 2: NextAuth Cannot Natively Hold Two Simultaneous Google Sessions

**What goes wrong:**
NextAuth is designed for one authenticated user identity per session. If you try to manage two Google accounts (school + personal) by running two OAuth flows within the same NextAuth session, the second sign-in either overwrites the first session or triggers `OAuthAccountNotLinked` errors. The accounts table ends up with two entries mapped to the same user ID, creating confused token state.

**Why it happens:**
NextAuth treats each OAuth sign-in as the user's primary identity. The library has no first-class support for "connect a second account without changing the primary session user." Developers try to run the Google flow twice and expect both tokens to persist; they do not.

**How to avoid:**
Do not use NextAuth as the token manager for both accounts. Use NextAuth for the personal Google account (the user's "login" identity), and implement a separate OAuth 2.0 Authorization Code flow manually (or via `googleapis` library directly) for the school account token. Store the school account refresh token in the database associated with the user's primary session. This is the "connected accounts" pattern — one primary auth, one linked secondary credential.

**Warning signs:**
- Second Google sign-in redirects back to home page but school token is gone
- `OAuthAccountNotLinked` error in NextAuth logs
- Session object contains only one of the two accounts' tokens after double sign-in

**Phase to address:**
OAuth implementation phase — architect the two-token model before writing any session code.

---

### Pitfall 3: Refresh Token Not Returned on Subsequent Google OAuth Sign-ins

**What goes wrong:**
Google only returns a refresh token on the very first OAuth authorization for a given client+user combination. Subsequent sign-ins via the same OAuth flow return only an access token. If the stored refresh token is lost (e.g., cleared database, re-deployment wiping state), there is no automatic way to get a new one without the user explicitly revoking and re-granting access.

**Why it happens:**
Developers see the `access_token` in the OAuth callback and assume the `refresh_token` will always be there. On first login it is. After that, it is absent unless `access_type=offline&prompt=consent` are explicitly added to every authorization URL.

**How to avoid:**
Always include `access_type: "offline"` and `prompt: "consent"` in the Google OAuth authorization parameters. `prompt: "consent"` forces Google to present the consent screen again and issue a new refresh token. This is a deliberate UX tradeoff (user sees consent screen every login) but is the only reliable way to always get a refresh token. Store the returned refresh token immediately and durably on first receipt.

**Warning signs:**
- OAuth callback contains `access_token` but `refresh_token` is `undefined` or absent
- Works for new users, breaks after first logout + re-login
- Scheduled sync fails after the initial 1-hour access token expires

**Phase to address:**
OAuth implementation phase — add these parameters from the start; retrofitting causes all existing users to lose sync.

---

### Pitfall 4: Storing Refresh Tokens in JWTs (Cookie) Instead of Database

**What goes wrong:**
NextAuth JWT sessions store tokens in an encrypted cookie. Browser cookies have a 4 KB size limit. Storing two Google refresh tokens (each ~200 bytes) plus session metadata approaches or exceeds this limit, silently truncating the cookie. The truncated JWT fails decryption and the session appears invalid. Additionally, JWT sessions cannot be invalidated before expiration — a revoked token keeps working until the JWT expires.

**Why it happens:**
JWT session strategy is the default and requires no database setup. Developers use it for simplicity without realizing the size constraint or that it is not revocable.

**How to avoid:**
Use database sessions (not JWT) when persisting OAuth tokens. Store refresh tokens in the database associated with the user record. This keeps cookies small (session ID only), enables token revocation, and is the correct approach when handling sensitive long-lived credentials. Use a proper database (Vercel Postgres, Supabase, PlanetScale) — not in-memory state that evaporates between serverless invocations.

**Warning signs:**
- Session randomly appears invalid after connecting multiple accounts
- `next-auth` logs show JWT decryption failures
- Sync works in development but fails randomly in production

**Phase to address:**
OAuth implementation phase — the database session vs JWT decision must be made before building token storage; changing it later requires migrating all sessions.

---

### Pitfall 5: Vercel Hobby Plan Allows Only One Cron Per Day

**What goes wrong:**
On the Vercel Hobby (free) plan, cron jobs can only be configured to run once per day maximum. Any cron expression that resolves to more frequent invocations (e.g., `*/30 * * * *` for every 30 minutes) will fail at deployment time. Vercel also invokes Hobby cron jobs at a random point within the specified hour rather than at the exact minute, so `0 8 * * *` might fire at 08:43 instead of 08:00.

**Why it happens:**
Developers test locally where there is no cron enforcement, or deploy on Pro during development and then switch to Hobby for cost reasons. The cron configuration looks valid in `vercel.json` but deployment silently fails or the schedule is imprecise.

**How to avoid:**
If the user wants hourly or more frequent sync, the project must be on Vercel Pro. Design `vercel.json` cron schedules explicitly for Hobby limitations during MVP (daily sync only), with clear upgrade path documented. Alternatively, use an external cron trigger service (e.g., GitHub Actions schedule, Upstash QStash) to call the Vercel endpoint more frequently without being bound by Vercel plan limits.

**Warning signs:**
- Deployment succeeds but cron jobs don't appear in Vercel dashboard
- Deployment fails with "cron job limit exceeded" error
- Sync fires at unexpected times

**Phase to address:**
Scheduled sync phase — choose frequency and plan tier before writing cron configuration.

---

### Pitfall 6: Vercel Cron Does Not Retry on Failure

**What goes wrong:**
If a cron-triggered Vercel function throws an error, times out, or returns a non-2xx status, Vercel does nothing. There is no automatic retry. The sync run is silently skipped. Users will not notice until they check the calendar and see missing events.

**Why it happens:**
Developers assume server infrastructure retries failed jobs as traditional cron daemons or job queues do. Vercel's serverless cron is purely a "fire and forget" HTTP request — no retry, no queue, no dead-letter bucket.

**How to avoid:**
Build retry logic inside the sync function itself (catch rate-limit errors and loop with exponential backoff). Implement idempotent sync operations so that re-running produces the same result without duplicates. Add observability (Vercel runtime logs + optionally an external alert on sync failure) so silent failures are detectable. Consider idempotency tokens on event creation to make double-runs safe.

**Warning signs:**
- Calendar events go stale without any error shown to the user
- Vercel function logs show 500s or timeouts on cron invocations
- No events created after a Google Calendar API quota burst

**Phase to address:**
Scheduled sync phase — design for failure-tolerance from the start; bolting on retry logic afterward breaks idempotency assumptions.

---

### Pitfall 7: Vercel Serverless Function Timeout During Large Sync

**What goes wrong:**
The default Vercel Serverless Function timeout on the Hobby plan is 10 seconds. Pro plan is 60 seconds (configurable to 800 seconds with Fluid Compute). A sync that processes a full semester of Canvas events plus mirrors a school calendar can easily exceed 10–60 seconds when each event requires individual Google Calendar API calls (the existing `gcalSync.ts` pattern).

**Why it happens:**
The existing codebase makes one `calendar.events.list()` + one `update/insert` call per event with `CONCURRENCY = 3`. For a student with 5 courses × 20 assignments + 50 school calendar events = 150 API calls at ~200ms each = 30 seconds minimum, before any rate-limit back-off.

**How to avoid:**
Batch Google Calendar API operations using the batch endpoint. Implement incremental sync using Google's `syncToken` mechanism — only sync changed events rather than all events every run. Set `maxDuration` in `vercel.json` to the plan maximum. As a fallback, trigger sync asynchronously: the cron endpoint returns 200 immediately, then processes in the background using `waitUntil` (Vercel Fluid Compute) or offloads to a queue.

**Warning signs:**
- Sync function times out intermittently, especially at semester start when many events are new
- Vercel logs show 504 Gateway Timeout on cron invocations
- The 10-second Hobby limit is too small for any realistic dataset

**Phase to address:**
Scheduled sync phase — confirm plan limits and implement batching before writing sync logic; retrofitting batching is painful.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing tokens in process memory / module-level variables | No database needed | Variables lost between serverless invocations; sync always broken in production | Never — serverless is stateless |
| JWT session strategy for OAuth tokens | No database setup | 4 KB cookie limit; tokens lost when cookie truncated; cannot revoke | Never for multi-token use |
| Manual access token input (current state) | No OAuth implementation needed | Tokens expire in 1 hour; users must re-paste constantly | Prototype only, not production |
| Full sync every run (re-fetch all events) | Simple implementation | Rate limits hit for large calendars; timeout risk; duplicate events | MVP only; replace with incremental sync quickly |
| Single-call-per-event API pattern (current `gcalSync.ts`) | Easy to reason about | 150+ API calls per sync; rate-limited; slow; timeout-prone | Small datasets only; replace with batching before scheduled sync |
| OAuth app stays in Testing mode | No Google verification required | Refresh tokens silently expire after 7 days | Development only, never production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Relying on NextAuth for two simultaneous Google account sessions | Use NextAuth for primary account; implement separate token flow for school account stored as a linked credential in DB |
| Google OAuth | Not requesting `access_type=offline&prompt=consent` | Always pass both on every authorization URL to guarantee refresh token is returned |
| Google Calendar API | Using `privateExtendedProperty` filter as sole deduplication key | Primary dedup key; add fallback search by title+date range when extended property query returns empty |
| Google Calendar API | Performing full sync every cron run | Use sync tokens (`nextSyncToken`) from the Calendar API for incremental sync; full sync only on first run or 410 response |
| Google Calendar API | Ignoring 410 responses to sync token requests | A 410 means the sync token is invalid; must discard all cached state and perform a full re-sync |
| Vercel Cron | Endpoint that returns a 3xx redirect | Cron invocation treats 3xx as final response (no redirect follow); endpoint must return 2xx directly |
| Vercel Cron | No `CRON_SECRET` check on the endpoint | Any external actor can trigger a sync by hitting the endpoint URL; always verify `Authorization: Bearer ${CRON_SECRET}` header |
| Google OAuth | Not handling `invalid_grant` by prompting re-auth | Token may be silently expired; catch `invalid_grant`, mark the account as needing re-connect, and surface a UI prompt |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One API call per event (current pattern) | Sync takes 30–120 seconds; rate limit 429s; Vercel timeouts | Use Google Calendar batch API; implement incremental sync with `syncToken` | Any dataset over ~20 events |
| Polling all events on every cron run | Full quota consumed daily even when no events changed | Implement Google Calendar push notifications or `syncToken`-based incremental sync | At ~5+ syncs per day with 100+ events |
| Hardcoded `CONCURRENCY = 3` with shared mutable queue (current `gcalSync.ts`) | Race conditions under concurrent execution; incorrect event count | Replace with `p-queue` library; use proper promise pool pattern | Any non-trivial async load |
| Cron running at aligned clock times (midnight, top-of-hour) | Rate limit bursts; Google's per-minute-per-project quota exceeded if multiple users sync simultaneously | Randomize cron schedule by user (e.g., hash user ID to offset) | Multi-user deployment |
| Syncing deleted Canvas events without tombstone tracking | Deleted assignments accumulate in Google Calendar indefinitely | Track synced event IDs with `canvasEventId` extended property; explicitly delete GCal events when they no longer appear in ICS feed | First time a Canvas assignment is deleted |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending access tokens in HTTP request body (current state in `CalendarSetup.tsx`) | Tokens logged in server logs, proxies, and browser history | Server-side OAuth only; tokens never leave the server; client only exchanges authorization codes |
| Storing refresh tokens in plaintext environment variables | Any Vercel project member or leaked env dump exposes all user tokens | Use encrypted secret storage; if single-user app, accept the risk but document it explicitly |
| No CSRF protection on sync API routes | Attacker can trigger sync on behalf of authenticated user | Add `CRON_SECRET` check on cron route; use SameSite=Strict cookies or CSRF tokens on user-triggered routes |
| `access_type=offline` without `prompt=consent` | Refresh token absent after first login; sync breaks after 1 hour silently | Always include both parameters on authorization URL |
| School account refresh token with overbroad scopes | Broader-than-needed access to school Google account | Request only `https://www.googleapis.com/auth/calendar.readonly` for school account (read-only mirror); use `https://www.googleapis.com/auth/calendar.events` for personal account only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent sync failure | User sees stale calendar, assumes app is working; misses deadlines | Surface last-sync timestamp in UI; show "sync failed" banner; send email/notification on repeated failure |
| Vague "sync complete" message without change summary | User does not know if anything actually synced | Show "X events added, Y updated, Z deleted" with event names |
| No re-authentication prompt when token expires | User sees generic error or nothing; confused about why sync stopped | Detect `invalid_grant`, flag account in DB, show prominent "Reconnect school account" CTA in UI |
| Forcing full re-OAuth when only school token expired | User must re-authorize everything | Expire and re-authorize only the affected account token independently |
| No confirmation before first sync to personal calendar | User may not realize events are about to be written to their calendar | Show a dry-run preview: "X events will be added to [calendar name]" with confirmation step |

---

## "Looks Done But Isn't" Checklist

- [ ] **OAuth flow:** Appears to authenticate — verify that the callback actually stores a `refresh_token` (not just `access_token`) and that it persists beyond a server restart
- [ ] **School account connection:** Google sign-in completes — verify the school account token is stored separately from the primary session, not merged/overwritten
- [ ] **Scheduled sync:** Vercel cron appears in dashboard — verify it actually executes by checking runtime logs, not just the presence in cron settings
- [ ] **Token refresh:** First sync works — verify sync still works 1+ hour later when the access token has expired (confirming refresh flow is operational)
- [ ] **Deduplication:** Events sync without duplicates on first run — verify running sync twice produces no new duplicates (idempotency test)
- [ ] **Deleted event handling:** Events sync in — verify that removing a course from the filter actually deletes the corresponding GCal events on next sync (not just stops adding new ones)
- [ ] **OAuth app in Production mode:** App works for developer — verify the OAuth consent screen publishing status is "Production", not "Testing" (7-day token expiry in Testing mode)
- [ ] **Cron security:** Sync endpoint responds — verify endpoint rejects requests without valid `CRON_SECRET` header (unauthorized invocation blocked)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth app stayed in Testing mode; all refresh tokens expired | MEDIUM | Publish app to Production; detect `invalid_grant` on next sync attempt; show re-auth prompt to user; user re-connects accounts |
| Duplicate events from non-idempotent sync runs | MEDIUM | Write a cleanup script that queries GCal events by `canvasEventId` extended property and deletes duplicates; run once |
| Refresh token missing from DB (lost on re-deploy / DB wipe) | LOW (single user) | Add `prompt=consent` to OAuth URL; user re-authorizes; new refresh token stored |
| Vercel function timing out on large sync | MEDIUM | Implement batch API calls; add `maxDuration` config; split sync into pages using pagination |
| Sync token (syncToken) returns 410 | LOW | Detected automatically; discard cached sync token; perform full re-sync; store new syncToken from result |
| School account token stored in wrong session layer (JWT vs DB) | HIGH | Requires session model migration; all users must re-authenticate; no in-place upgrade path |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth app in Testing mode (7-day token expiry) | OAuth implementation phase | Check Google Cloud Console consent screen status before deploying; integration test: token still valid after 7+ days |
| NextAuth dual-account session design | OAuth implementation phase | Architecture review: confirm school token stored as linked credential, not in primary session |
| Missing `access_type=offline&prompt=consent` | OAuth implementation phase | OAuth callback always returns `refresh_token`; test by signing out and back in with same account |
| JWT session cookie size limit (4 KB truncation) | OAuth implementation phase | Use database session strategy; test session with both tokens stored |
| Vercel Hobby cron limited to once per day | Scheduled sync phase | Confirm plan tier; test `vercel.json` cron schedule deploys without error |
| No retry on cron failure | Scheduled sync phase | Integration test: simulate API 429 during cron; verify sync retries with backoff and eventually succeeds |
| Function timeout on large sync | Scheduled sync phase | Load test with 150+ events; confirm sync completes within `maxDuration`; implement batching first |
| Single-event-per-call API pattern causing rate limits | Scheduled sync phase | Replace with batch API calls before adding cron; verify event count × latency fits within timeout |
| Duplicate events from full re-sync | Scheduled sync phase | Run sync twice; verify event count in GCal unchanged on second run |
| No deleted-event cleanup | Event filtering phase | Remove a course from filter; verify corresponding GCal events are deleted on next sync |
| Token in HTTP request body (current state) | OAuth implementation phase | Server-side OAuth flow; tokens never appear in client request body; audit logs for absence |
| Silent sync failures | Scheduled sync phase | Surface last-sync timestamp and status in UI; verify UI shows error state when sync fails |

---

## Sources

- [Google Calendar API: Manage Quotas](https://developers.google.com/workspace/calendar/api/guides/quota) — official quota limits and best practices (HIGH confidence)
- [Google Calendar API: Synchronize Resources Efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) — syncToken-based incremental sync, 410 handling (HIGH confidence)
- [Google Calendar API: Handle API Errors](https://developers.google.com/workspace/calendar/api/guides/errors) — rate limit error codes 403/429 (HIGH confidence)
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — refresh token storage, `invalid_grant` handling (HIGH confidence)
- [Google OAuth: Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) — authorization code flow, `access_type=offline` (HIGH confidence)
- [Nango: Google OAuth invalid_grant causes and fixes](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked) — Testing mode 7-day expiry, token limit, inactivity (MEDIUM confidence — third-party but verified against Google docs)
- [Vercel: Cron Jobs documentation](https://vercel.com/docs/cron-jobs) — Hobby plan limits, UTC timezone, one-per-day restriction (HIGH confidence)
- [Vercel: Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — no-retry behavior, concurrency/idempotency, CRON_SECRET, redirect handling (HIGH confidence)
- [NextAuth.js: Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) — token rotation approach, race condition in serverless (HIGH confidence)
- [NextAuth.js Discussion: Multiple Google Accounts](https://github.com/nextauthjs/next-auth/discussions/1702) — one user, multiple provider accounts pattern (MEDIUM confidence)
- [NextAuth.js Discussion: Simultaneous Sessions Anti-pattern](https://github.com/nextauthjs/next-auth/discussions/1728) — simultaneous multi-session not supported (MEDIUM confidence)
- [Codebase CONCERNS.md](../.planning/codebase/CONCERNS.md) — existing known issues: unencrypted token handling, broken concurrency queue, extended property dedup fragility (HIGH confidence — direct code analysis)

---
*Pitfalls research for: Canvas-to-Google-Calendar sync app (multi-account OAuth, calendar mirroring, serverless cron)*
*Researched: 2026-03-11*

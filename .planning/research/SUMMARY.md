# Project Research Summary

**Project:** canvas-to-gcal
**Domain:** LMS-to-Google-Calendar sync app (Canvas ICS + dual-account Google Calendar mirroring)
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

This project is a personal student productivity tool that bridges two data sources — the Canvas LMS ICS feed and a school Google Calendar — into a single personal Google Calendar. The core challenge is not the sync logic itself (much of which exists in `icalParser.ts` and `gcalSync.ts`) but the transition from a stateless prototype with manual token pasting to a production-grade app with persistent OAuth, background scheduling, and dual-account Google API access. Every meaningful feature in this milestone depends on solving persistent state first: tokens must survive page reloads, server restarts, and background cron invocations.

The recommended approach is `arctic` + `jose` for OAuth (not NextAuth, which cannot hold two simultaneous Google identities without significant workarounds), Neon Postgres as the backing store for tokens and preferences, and Vercel Cron for once-daily scheduled sync. The architecture extends the existing three-layer structure by adding a database layer, a `syncOrchestrator` service, and a `tokenStore` service. The existing `icalParser` and `gcalSync` services require minimal changes. The build order is strictly dependency-driven: schema first, then auth layer, then token store, then orchestrator, then UI.

The dominant risk cluster is OAuth misconfiguration. Three separate pitfalls — OAuth app left in Testing mode (7-day refresh token expiry), missing `prompt=consent` on authorization URLs (no refresh token returned on re-login), and using JWT cookie sessions instead of database sessions (4 KB limit, no revocation) — can each silently break the entire sync pipeline. All three must be addressed in the OAuth implementation phase before writing any sync logic. Secondary risks are Vercel Hobby plan constraints (once-per-day cron, function timeout) and the performance cost of the existing per-event API call pattern in `gcalSync.ts`, which will time out on any realistic dataset without batching.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js 16 App Router, React 19, `node-ical`, `googleapis`, Tailwind v4, Jest) requires only two new runtime dependencies: `arctic@3.7.0` for the OAuth authorization code flow and `jose@6.2.1` for JWE token encryption. NextAuth is explicitly ruled out — its session model is designed for a single authenticated user identity, and the dual-account requirement (school + personal Google, both live simultaneously) fights the library's assumptions in ways that cannot be cleanly worked around.

Token storage lands in Neon Postgres (via `@neondatabase/serverless` + Drizzle ORM) rather than cookies or environment variables. Cookie-based token storage fails at 4 KB for two accounts; environment variables are not per-user. Scheduled sync uses Vercel's native cron feature (zero additional dependencies), constrained to once per day on the Hobby plan with Fluid Compute providing a 300-second function timeout.

**Core technologies:**
- `arctic@3.7.0`: OAuth 2.0 authorization code flow for Google — lightweight, runtime-agnostic, does not impose a session model
- `jose@6.2.1`: JWE encryption for token cookies / session payloads — recommended directly by Next.js official docs
- Neon Postgres + Drizzle ORM: persistent token and preferences storage — required for cron access to tokens without a live user session
- Vercel Cron: once-daily scheduled sync trigger — native to platform, zero dependencies, configured in `vercel.json`

### Expected Features

The feature dependency graph has a single critical path: both Google OAuth grants must be obtained and tokens persisted before any sync can run, and course filtering must be in place before event-level filtering can be offered. The manual sync trigger and the scheduled cron are the same pipeline invoked from different callers — this shared-orchestrator pattern is non-negotiable for maintainability.

**Must have (table stakes):**
- Google OAuth for both accounts (school + personal) — without this, nothing works; users expect OAuth, not token pasting
- Persistent token storage (database sessions) — tokens must survive past the browser session for scheduled sync
- Course-level filtering UI — users have many Canvas courses; no filtering means the product is unusable
- Push selected Canvas assignments to personal Google Calendar — primary value delivery
- School Google Calendar mirror to personal (one-way) — second half of core value proposition
- Manual "Sync Now" trigger with loading state — user control; also the primary testing mechanism
- Sync status display (last synced timestamp + event counts) — essential trust signal
- Basic error feedback (auth failure, bad ICS URL, API quota) — silent failures destroy trust

**Should have (competitive):**
- Automatic scheduled sync (daily cron) — "set and forget"; upgrade after manual sync is proven reliable
- Selective school calendar mirroring (choose which school calendars) — reduces noise once mirroring works
- Sync run summary (X created, Y updated, Z deleted) — transparency that distinguishes this from generic sync tools
- Canvas course color mapping to GCal — low-effort polish

**Defer (v2+):**
- Event-level filtering within a course — high complexity; validate that course-level filtering is insufficient first
- PWA / add-to-home-screen — useful only after core reliability is established
- Event field control (include/exclude description, points) — nice-to-have, not blocking

**Explicit anti-features (do not build):**
- Two-way/bidirectional sync — creates update loops; school IT restrictions likely prevent writes
- Real-time push sync — Canvas ICS is pull-only; webhooks add major operational complexity
- Non-Google calendar targets — multiplicative complexity with no payoff for stated use case

### Architecture Approach

The architecture adds three concerns to the existing three-layer structure: a database layer for persistent state, a `syncOrchestrator` service that coordinates the full sync cycle, and a `tokenStore` service that retrieves and refreshes OAuth tokens for both accounts. The cron route and the manual sync API route are thin wrappers over the same `syncOrchestrator` function — sync logic lives in one place. The school and personal Google accounts require two entirely separate `googleapis` OAuth2 clients; sharing a single client between accounts causes subtle authorization failures during token auto-refresh.

**Major components:**
1. `lib/auth.ts` + `/api/auth/[account]/[start|callback]` — OAuth authorization code flow via `arctic`; two independent flows, two separate cookie/DB records
2. `db/schema.ts` + `lib/db.ts` — Drizzle schema (`users`, `accounts`, `preferences`, `sync_log`); all persistent state lives here
3. `services/tokenStore.ts` — retrieves and refreshes OAuth tokens for both accounts; called by orchestrator before every sync
4. `services/filterEngine.ts` — applies course/event filter rules from user preferences to parsed Canvas events
5. `services/syncOrchestrator.ts` — coordinates full sync cycle: ICS parse → filter → mirror school calendar → write to personal; called by both manual and cron routes
6. `/api/cron/sync` — Vercel cron endpoint; verifies `CRON_SECRET` header; calls orchestrator for all users with active tokens
7. `AccountLinkStatus` + `SyncStatus` UI components — show connection state, last sync result, manual trigger button

### Critical Pitfalls

1. **OAuth app in Testing mode (7-day refresh token expiry)** — publish consent screen to Production status before any real deployment; add target accounts as Test Users during development to at least make failure predictable
2. **Missing `access_type=offline&prompt=consent` on authorization URLs** — always include both parameters on every Google authorization URL; without `prompt=consent`, Google stops returning refresh tokens after the first grant, breaking scheduled sync silently after 1 hour
3. **JWT session cookie strategy with multiple OAuth tokens** — use database sessions (not JWT); JWT strategy hits 4 KB cookie limit with two accounts' tokens; also cannot be revoked; this decision cannot be changed after launch without migrating all sessions
4. **Per-event API call pattern in `gcalSync.ts`** — the existing `CONCURRENCY = 3` single-event-per-call pattern will time out on realistic datasets (5 courses × 20 events = 150 API calls minimum); implement Google Calendar batch API and `syncToken`-based incremental sync before enabling scheduled cron
5. **No retry on Vercel cron failure** — Vercel fires cron once and discards failures silently; build retry logic inside the sync function with exponential backoff; ensure sync is fully idempotent (existing dedup logic in `gcalSync.ts` helps but must be verified)

---

## Implications for Roadmap

The feature dependency graph and pitfall-to-phase mapping from research converge on the same build order. Every feature gates on persistent OAuth tokens. The scheduler gates on working sync. UI polish gates on working scheduler. This is not a preference — it is the only order that avoids the high-recovery-cost pitfalls (particularly the "school account token stored in wrong session layer" pitfall, which requires a full session migration to fix).

### Phase 1: Foundation — Database Schema + Auth Infrastructure

**Rationale:** Everything else is blocked until persistent state exists and OAuth tokens can be stored and retrieved. This is the highest-leverage phase; mistakes here (wrong session strategy, missing DB columns) are the most expensive to fix later.
**Delivers:** Neon Postgres schema (`users`, `accounts`, `preferences`, `sync_log`), Drizzle ORM setup, `arctic`-based OAuth flows for both Google accounts, `tokenStore` service with token refresh, basic account link status UI
**Addresses:** Google OAuth (both accounts), persistent token storage
**Avoids:** JWT session cookie overflow, missing refresh tokens, OAuth app in Testing mode, school account token merged into primary session

### Phase 2: Core Sync Pipeline

**Rationale:** With tokens available in the database, the full sync pipeline can be assembled. The existing `icalParser` and `gcalSync` services need minimal changes; the new `syncOrchestrator` wires them together with the token and filter layers.
**Delivers:** `filterEngine` service, `syncOrchestrator` service, `/api/sync` manual trigger endpoint, course-level filtering UI, basic sync status display (last synced timestamp, event counts), school calendar mirror (one-way)
**Uses:** `googleapis` dual-client pattern (school read, personal write), `arctic` token refresh via `tokenStore`
**Implements:** syncOrchestrator + filterEngine + extended gcalSync
**Avoids:** Single shared OAuth client for both accounts, full-sync-every-run performance trap (implement syncToken from the start)

### Phase 3: Scheduled Sync + Reliability

**Rationale:** Scheduled sync is only safe to enable after manual sync is proven idempotent and performant. Adding cron before fixing the per-event API call pattern guarantees timeout failures.
**Delivers:** `vercel.json` cron configuration, `/api/cron/sync` secured endpoint, batch API calls replacing per-event calls, error handling with retry/backoff, sync failure surfacing in UI, deleted-event cleanup
**Uses:** Vercel Cron (once daily, Hobby plan), `CRON_SECRET` header verification, Google Calendar batch endpoint
**Avoids:** Vercel Hobby cron frequency limits, function timeout on large sync, no-retry silent failures, stale deleted events accumulating in GCal

### Phase 4: Polish + UX Improvements

**Rationale:** Once the core pipeline is stable and scheduled sync is running, low-risk improvements can be layered on without structural changes.
**Delivers:** Selective school calendar mirroring (choose which school calendars), sync run summary (X created/updated/deleted), Canvas course color mapping to GCal, re-authentication prompt on `invalid_grant`, dry-run preview before first sync
**Avoids:** Silent auth failures confusing users, no feedback on what actually synced

### Phase Ordering Rationale

- Database schema must come before auth because Auth.js/arctic account storage requires the schema to exist at migration time
- OAuth must be fully working (including refresh token storage and retrieval) before sync can be written — the orchestrator's first action is `tokenStore.getCalendarClient()`
- Manual sync must be proven reliable and idempotent before cron is enabled — cron failures are silent; a broken sync running daily is worse than no cron
- Batching and incremental sync (syncToken) belong in Phase 3, not Phase 2, because they require a working sync to test against — but must be completed before cron is active
- UI polish phases defer until the backend contract is stable — changing the sync result shape after building the summary UI wastes effort

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Auth Infrastructure):** The account-linking pattern (one primary session + one linked secondary credential) has only MEDIUM-confidence documentation in NextAuth discussions. The `arctic`-based custom flow diverges from NextAuth conventions — the exact callback flow for the school account (state parameter encoding, PKCE verifier handling, DB write in callback) should be sketched in detail before implementation.
- **Phase 3 (Scheduled Sync):** Google Calendar batch API and `syncToken` incremental sync are well-documented but have non-obvious error handling (410 responses invalidate the sync token and require full re-sync). This flow needs explicit design before coding.

Phases with standard patterns (can skip research-phase):
- **Phase 2 (Core Sync):** The orchestrator pattern and dual-client approach are well-documented and directly supported by existing `googleapis` client. The data flow is straightforward.
- **Phase 4 (Polish):** All items are incremental additions to working systems. No novel integrations required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registry and official docs on 2026-03-11; Vercel plan limits confirmed against official pricing docs |
| Features | MEDIUM-HIGH | Table stakes and anti-features are well-established from competitor analysis; Canvas ICS specifics from official Instructure docs; feature prioritization is inference from user research patterns |
| Architecture | HIGH (Vercel/Google), MEDIUM (account-linking) | Vercel cron and Google OAuth dual-client patterns are from official sources; the NextAuth account-linking pattern is community-documented, not official API |
| Pitfalls | HIGH | Most pitfalls verified against official docs; the dual-account NextAuth session problem is confirmed by multiple independent community discussions |

**Overall confidence:** HIGH

### Gaps to Address

- **Auth.js vs raw arctic for school account linking:** ARCHITECTURE.md references NextAuth for both accounts while STACK.md recommends raw `arctic` + `jose` for the multi-account case. The correct reconciliation is: use `arctic` for the custom OAuth authorization code flow for both accounts, store tokens in the database directly (Drizzle), and skip NextAuth entirely. This should be confirmed as a deliberate decision at the start of Phase 1 before writing any auth code.
- **Google Workspace admin restrictions on school OAuth:** Some institutions restrict third-party OAuth access to school Google accounts. There is no way to determine this before the user attempts to connect. The onboarding flow must handle this gracefully with a clear "your school may block this — contact IT or use the manual ICS method" fallback message.
- **Neon free tier connection limits:** Neon free tier has a connection limit (typically 20 concurrent connections). For a personal tool this is not a concern, but should be verified if the user base grows. Drizzle + PgBouncer pooling via the Neon serverless driver mitigates this.
- **`gcalSync.ts` concurrency implementation:** PITFALLS.md flags the existing `CONCURRENCY = 3` mutable queue as having race condition risk under concurrent execution. This should be audited and replaced with `p-queue` during Phase 2 before the orchestrator calls it in parallel for multiple users.

---

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Jobs: Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby plan once-per-day limit, Pro plan per-minute precision
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — 300s max duration on Hobby with Fluid Compute (enabled by default April 2025)
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — no-retry behavior, CRON_SECRET, idempotency requirement
- [Arctic v3 Google provider](https://arcticjs.dev/providers/google) — OAuth authorization code flow API
- [Google OAuth 2.0 Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — refresh token storage, invalid_grant handling
- [Google Calendar API: Synchronize Resources Efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) — syncToken incremental sync, 410 handling
- [Google Calendar API: Handle API Errors](https://developers.google.com/workspace/calendar/api/guides/errors) — rate limit error codes
- [Next.js authentication guide](https://nextjs.org/docs/pages/building-your-application/authentication) — recommends jose for session encryption
- [Auth.js Pg Adapter](https://authjs.dev/getting-started/adapters/pg) — database session strategy
- npm registry: arctic@3.7.0, jose@6.2.1, next-auth@4.24.13 (latest stable) — verified 2026-03-11

### Secondary (MEDIUM confidence)
- [NextAuth.js Discussion: Multiple Google Accounts](https://github.com/nextauthjs/next-auth/discussions/1702) — account-linking pattern for one user, multiple provider accounts
- [NextAuth.js Discussion: Simultaneous Sessions Anti-pattern](https://github.com/nextauthjs/next-auth/discussions/1728) — simultaneous multi-session not supported
- [Nango: Google OAuth invalid_grant causes](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked) — Testing mode 7-day expiry (verified against Google docs)
- [CalendarBridge](https://calendarbridge.com), [SyncGene](https://slashdot.org/software/comparison/CalendarBridge-vs-SyncGene/) — competitor feature sets
- [Canvas ICS Feed — Instructure Community](https://community.canvaslms.com/t5/Student-Guide/How-do-I-view-the-Calendar-iCal-feed-to-subscribe-to-an-external/ta-p/331) — Canvas ICS capabilities and limitations

### Tertiary (LOW confidence)
- Codebase `CONCERNS.md` (direct analysis) — existing known issues: unencrypted token handling, broken concurrency queue, extended property dedup fragility; HIGH confidence on the findings but classified here as internal artifact

---

*Research completed: 2026-03-11*
*Ready for roadmap: yes*

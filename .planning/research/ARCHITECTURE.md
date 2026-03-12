# Architecture Research

**Domain:** Canvas-to-Google-Calendar sync (multi-account OAuth, scheduled sync, calendar mirroring)
**Researched:** 2026-03-11
**Confidence:** HIGH (Vercel and Google OAuth official docs), MEDIUM (account-linking pattern), LOW (DB schema specifics)

## Standard Architecture

### System Overview

The new milestone adds three structural concerns that don't exist in the current codebase:
persistent state (tokens + preferences), a background worker (scheduled sync), and dual-client
Google API access (read from school, write to personal). The existing three-layer architecture
extends cleanly, but gains a database layer and a dedicated sync worker path.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  AuthFlow UI     │  │  FilterSetup UI  │  │  SyncStatus UI │  │
│  └────────┬─────────┘  └────────┬────────┘  └───────┬────────┘  │
└───────────┼─────────────────────┼────────────────────┼──────────┘
            │  HTTP               │  HTTP               │  HTTP
┌───────────┼─────────────────────┼────────────────────┼──────────┐
│           │    Next.js App Router (Server)             │          │
│  ┌────────▼──────┐  ┌──────────▼──────┐  ┌───────────▼──────┐  │
│  │ /api/auth/    │  │ /api/preferences │  │ /api/sync        │  │
│  │ [...nextauth] │  │ (GET/POST)       │  │ (POST, manual)   │  │
│  └────────┬──────┘  └──────────┬──────┘  └───────────┬──────┘  │
│           │                    │                       │          │
│  ┌────────▼────────────────────▼───────────────────────▼──────┐  │
│  │                        Service Layer                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ tokenStore  │  │ filterEngine │  │   syncOrchestra  │  │  │
│  │  │  .ts        │  │  .ts         │  │   tor.ts         │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │  │
│  └─────────┼────────────────┼────────────────────┼────────────┘  │
│            │                │                    │               │
│  ┌─────────▼────────────────▼────────────────────▼────────────┐  │
│  │                      Database (Neon Postgres)                │  │
│  │  users | accounts (tokens) | preferences | sync_log         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Vercel Cron  →  /api/cron/sync                │  │
│  │  (triggers syncOrchestrator for all active users)          │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
            │                                    │
     ┌──────▼──────┐                    ┌────────▼────────┐
     │ Canvas ICS  │                    │  Google Calendar │
     │ feed (HTTP) │                    │  API (two OAuth  │
     └─────────────┘                    │  clients)        │
                                        └─────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Talks To |
|-----------|----------------|----------|
| AuthFlow UI | Initiates OAuth sign-in for personal and school accounts, displays linked-account status | `/api/auth/[...nextauth]` |
| FilterSetup UI | Displays parsed courses, lets user toggle courses/events on/off, saves preferences | `/api/parse-ics`, `/api/preferences` |
| SyncStatus UI | Shows last sync time, result counts, manual trigger button | `/api/sync` |
| `/api/auth/[...nextauth]` | NextAuth route: handles OAuth callbacks, stores refresh tokens via database adapter | Auth.js (NextAuth v5), DB |
| `/api/preferences` | CRUD for per-user filter settings and Canvas feed URL | `filterEngine`, DB |
| `/api/sync` (manual) | Accepts POST to trigger immediate sync for authenticated user | `syncOrchestrator` |
| `/api/cron/sync` | Secured GET endpoint invoked by Vercel cron; triggers sync for all users with active tokens | `syncOrchestrator` |
| `tokenStore.ts` | Retrieves and refreshes OAuth tokens for both Google accounts; wraps Auth.js account records | DB, Google OAuth endpoints |
| `filterEngine.ts` | Applies course/event filter rules to a list of parsed Canvas events | DB (preferences), `icalParser` |
| `syncOrchestrator.ts` | Coordinates a full sync cycle: parse ICS → filter → mirror school → write to personal | `icalParser`, `gcalSync`, `tokenStore`, `filterEngine` |
| `icalParser.ts` | Existing: fetches + parses Canvas ICS feed, groups events by course | (no change) |
| `gcalSync.ts` | Existing: deduplicates and upserts events to Google Calendar; needs dual-client extension | Google Calendar API |
| Database (Neon Postgres) | Stores users, OAuth tokens (encrypted at rest via Auth.js), preferences, sync run log | All server services |
| Vercel Cron | Time-based trigger (once daily on Hobby, up to per-minute on Pro); calls `/api/cron/sync` via HTTP GET with Bearer secret | `/api/cron/sync` |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts        # Auth.js handler
│   │   ├── preferences/
│   │   │   └── route.ts            # GET + POST filter settings
│   │   ├── sync/
│   │   │   └── route.ts            # POST: manual sync trigger
│   │   ├── cron/
│   │   │   └── sync/
│   │   │       └── route.ts        # GET: Vercel cron endpoint
│   │   ├── parse-ics/
│   │   │   └── route.ts            # Existing (no change)
│   │   └── sync-gcal/
│   │       └── route.ts            # Existing (will be superseded)
│   ├── page.tsx                    # Existing
│   └── layout.tsx                  # Existing
├── components/
│   ├── CalendarSetup.tsx           # Existing (refactor to multi-step)
│   ├── AccountLinkStatus.tsx       # New: shows which accounts are linked
│   └── SyncStatus.tsx              # New: last sync, manual trigger
├── services/
│   ├── icalParser.ts               # Existing (no change)
│   ├── gcalSync.ts                 # Existing (extend to accept two clients)
│   ├── tokenStore.ts               # New: retrieve + refresh OAuth tokens
│   ├── filterEngine.ts             # New: apply course/event filter rules
│   └── syncOrchestrator.ts         # New: coordinates a full sync cycle
├── lib/
│   ├── auth.ts                     # Auth.js config (providers, adapter, callbacks)
│   └── db.ts                       # Neon serverless client + Drizzle instance
└── db/
    └── schema.ts                   # Drizzle schema: users, accounts, preferences, sync_log
```

### Structure Rationale

- **`services/`**: Contains domain logic. `syncOrchestrator.ts` is the main new addition — it owns the full sync cycle and is called by both the manual API route and the cron route, avoiding duplication.
- **`lib/`**: Infrastructure wiring (DB client, Auth.js config). Kept separate from services so services stay testable without framework dependencies.
- **`db/`**: Schema definitions separate from runtime code; Drizzle migrations live here.
- **`app/api/cron/`**: Isolated from other API routes to make the security boundary explicit. The cron route must verify `CRON_SECRET`; no other route needs this.

## Architectural Patterns

### Pattern 1: OAuth Account Linking via NextAuth v5 + Database Adapter

**What:** The user signs in once (establishing a session on their personal Google account), then initiates a second OAuth flow to link their school account. Auth.js stores both OAuth accounts in a shared `accounts` table, keyed to the same `userId`. The `tokenStore` service loads the correct account's `access_token` and `refresh_token` by `provider_account_id` or a stored label (`school` vs `personal`).

**When to use:** Any time one user needs to act on behalf of two separate OAuth identities. This is the standard approach for account-linking in Auth.js (NextAuth).

**Trade-offs:**
- Pro: Auth.js handles token encryption, rotation callbacks, and PKCE automatically.
- Pro: Existing `/api/auth/[...nextauth]` route handles both accounts; no custom OAuth plumbing.
- Con: Auth.js does not natively prompt a second sign-in for an already-authenticated user. The second sign-in must be triggered manually (custom endpoint that sets a `prompt=select_account` param on the Google authorize URL) and the `signIn` callback must detect a "link" intent rather than a new session.
- Con: The `accounts` table needs a `label` column (`school` | `personal`) since both accounts use the same Google provider.

**Implementation note:** Use `allowDangerousEmailAccountLinking: false` — the two accounts will have different email addresses (school vs personal), so automatic linking by email is wrong here. The link is intentional and UI-driven.

### Pattern 2: Vercel Cron → Secured Route Handler → Sync Orchestrator

**What:** `vercel.json` declares a `crons` entry pointing to `/api/cron/sync`. Vercel makes an HTTP GET to the production URL on schedule. The route verifies the `Authorization: Bearer $CRON_SECRET` header. On success, it calls `syncOrchestrator` for all users with valid stored tokens.

**When to use:** All background work in a serverless (Vercel) environment. Node-cron and `setInterval` do not work — the process is destroyed after each request. This is the only supported pattern.

**Trade-offs:**
- Pro: Zero infrastructure beyond `vercel.json` + one API route; no external scheduler service needed.
- Con: Hobby plan is limited to once per day (±59 min precision). Pro plan gets per-minute scheduling.
- Con: Vercel may fire the same cron twice (event-driven delivery). The sync must be idempotent (it is, because `gcalSync.ts` already deduplicates via `canvasCanvasUid` extended property).
- Con: Default Vercel Function max duration is 10s (Hobby) / 60s (Pro). A full sync for multiple users may exceed this; run per-user syncs in parallel with a concurrency limit, or fan out via separate POST requests.

**Securing the endpoint:**
```typescript
// src/app/api/cron/sync/route.ts
export function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // call syncOrchestrator(allActiveUsers)
}
```

### Pattern 3: Dual-Client Google Calendar Mirroring

**What:** The sync orchestrator creates two OAuth2 clients from `googleapis` — one initialized with the school account's tokens (scoped to `calendar.readonly`) and one with the personal account's tokens (scoped to `calendar.events`). It reads events from the school account's primary calendar, then writes them to the personal account's calendar via `gcalSync.ts`.

**When to use:** Any time events need to move between two Google accounts. Service accounts with domain-wide delegation are an alternative (for Google Workspace domains where the admin can grant access), but require admin action the user may not have. Two-user OAuth is the correct pattern for a personal tool where the user owns both accounts.

**Trade-offs:**
- Pro: Works for any Google account (consumer or Workspace); no admin setup required.
- Pro: Uses existing `gcalSync.ts` deduplication logic — just pass the personal-account client.
- Con: Both tokens must be stored and kept refreshed. `tokenStore.ts` must check expiry and call the Google token endpoint before handing a client to the orchestrator.
- Con: School accounts managed by an institution may have OAuth scope restrictions. If the school restricts third-party app access, the school OAuth flow will fail at authorization. This should be detected early and surfaced to the user.

**Token refresh pattern:**
```typescript
// src/services/tokenStore.ts
async function getCalendarClient(userId: string, label: 'school' | 'personal') {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.label, label))
  });
  const oauth2Client = new google.auth.OAuth2(/* credentials */);
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at * 1000,
  });
  // googleapis auto-refreshes if expiry_date is set and token is expired
  return google.calendar({ version: 'v3', auth: oauth2Client });
}
```

## Data Flow

### OAuth Account Linking Flow

```
User clicks "Connect School Account"
    |
    v
Custom route sets Google authorize URL
  with prompt=select_account + state=link:school
    |
    v
Google OAuth consent → redirect to /api/auth/callback/google
    |
    v
NextAuth signIn callback detects state=link:school
  → links new account record to existing userId
  → stores access_token, refresh_token, expires_at in accounts table
    |
    v
UI reads session → shows both accounts linked
```

### Scheduled Sync Flow

```
Vercel cron fires → GET /api/cron/sync
    |
    v
Verify CRON_SECRET
    |
    v
Load all users with linked school + personal tokens
    |  (parallel, with concurrency limit)
    v
For each user:
  tokenStore.getCalendarClient(userId, 'school')    -- read client
  tokenStore.getCalendarClient(userId, 'personal')  -- write client
    |
    v
filterEngine.getActiveFilters(userId)
    |
    v
icalParser.parseCanvasFeed(user.canvasFeedUrl)
    |  filtered result
    v
gcalSync.syncToGoogleCalendar({
  sourceClient: schoolClient,   -- reads school calendar
  destClient: personalClient,   -- writes to personal calendar
  events: filteredEvents,
})
    |
    v
syncLog.record(userId, { synced, skipped, failed, timestamp })
    |
    v
Return 200 { usersProcessed, totalSynced }
```

### Manual Sync Flow

```
User clicks "Sync Now"
    |
    v
POST /api/sync  (authenticated via NextAuth session cookie)
    |
    v
Extract userId from session → same path as scheduled sync (single user)
    |
    v
Return sync result to UI
```

### State Management

```
Server (DB)                                Client (React state)
-----------                                -------------------
users table                                session (from NextAuth cookie)
accounts table (tokens)    <-- Auth.js --> useSession() hook
preferences table          <-- SWR/fetch-> FilterSetup component state
sync_log table             <-- SWR/fetch-> SyncStatus component state
```

## Scaling Considerations

This is a personal tool (single user or a small number of users). Scaling is not a primary concern, but architecture should not create unnecessary bottlenecks.

| Scale | Architecture Adjustment |
|-------|-------------------------|
| 1-10 users | Single Vercel Function for cron, synchronous per-user sync, Neon free tier |
| 10-100 users | Fan-out: cron enqueues per-user sync tasks (e.g., via separate POST requests or Vercel Queue); stay within function duration limits |
| 100+ users | External queue (BullMQ + Redis, or Trigger.dev); upgrade to Vercel Pro for per-minute cron precision |

### Scaling Priorities

1. **First bottleneck:** Vercel Function max duration. A single cron function syncing 20+ users serially will time out. Fix: fan out per-user work into separate async requests.
2. **Second bottleneck:** Google Calendar API rate limits per OAuth client. Fix: existing sliding-window concurrency in `gcalSync.ts` already handles this.

## Anti-Patterns

### Anti-Pattern 1: Storing OAuth Tokens in NextAuth JWT Session Cookies

**What people do:** Forward OAuth `access_token` and `refresh_token` into the session JWT (via the `jwt` callback in NextAuth) so they're available on the client or in API route session objects without a DB lookup.

**Why it's wrong:** The cron job runs without a user session — it must retrieve tokens from the database on behalf of all users. Tokens in JWTs are per-user, per-browser, and expire when the cookie expires. There is no way to access them from a background job. Additionally, refresh tokens in cookies are lost when the user clears cookies.

**Do this instead:** Use a database adapter (Auth.js database session strategy). Tokens live in the `accounts` table. The `tokenStore` service reads them by `userId`, no session required.

### Anti-Pattern 2: Using `node-cron` or `setInterval` for Scheduled Sync

**What people do:** Register a cron expression inside the Next.js server startup code or an API route handler using `node-cron`.

**Why it's wrong:** Vercel serverless functions are stateless. The process is destroyed after each request. A `node-cron` timer registered during one request does not persist to the next. The cron fires once and never again.

**Do this instead:** Declare the schedule in `vercel.json` under `"crons"`. Vercel invokes a standard HTTP endpoint on schedule. The endpoint is a regular App Router route handler.

### Anti-Pattern 3: A Single Google OAuth Client for Both Accounts

**What people do:** Reuse the same OAuth2 client initialized with one set of tokens, and try to switch credentials mid-operation.

**Why it's wrong:** The `googleapis` client is stateful once credentials are set. Swapping tokens on an in-flight client leads to subtle authorization errors, especially during token auto-refresh. The school and personal accounts need different scopes (`calendar.readonly` vs `calendar.events`).

**Do this instead:** `tokenStore.getCalendarClient()` returns a fresh, fully-initialized `google.calendar` client per account per sync run. Keep the two clients separate through the entire sync cycle.

### Anti-Pattern 4: Triggering the Cron Endpoint Without Authentication

**What people do:** Leave the cron route unprotected, assuming Vercel is the only caller.

**Why it's wrong:** Any actor can POST to `/api/cron/sync` and trigger a sync for all users, exhausting Google API quota or generating unwanted calendar events.

**Do this instead:** Check `Authorization: Bearer $CRON_SECRET` as shown in Pattern 2. Vercel sets this header automatically when it invokes the route; your code rejects all other callers.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth (personal) | Auth.js GoogleProvider, database adapter | Scopes: `calendar.events`, `userinfo.email` |
| Google OAuth (school) | Auth.js GoogleProvider (second sign-in/link flow), same provider config | Scopes: `calendar.readonly`, `userinfo.email`. May be blocked by Workspace admin policy. |
| Google Calendar API | `googleapis` v3 REST client, two separate OAuth2 clients per sync | Rate limit: 1M queries/day per project; 10 requests/second/user |
| Canvas ICS feed | HTTP GET by `node-ical` (no auth) | URL is user-provided; validate before storing |
| Neon Postgres | `@neondatabase/serverless` driver + Drizzle ORM | Connection pooling via PgBouncer; works on Vercel Edge and Node runtimes |
| Vercel Cron | HTTP GET from Vercel infrastructure to `/api/cron/sync` | Hobby: once/day. Pro: up to once/minute. Always UTC. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API routes ↔ syncOrchestrator | Direct TypeScript function call | Both run server-side; no HTTP between them |
| syncOrchestrator ↔ tokenStore | Direct function call | tokenStore is a dependency injected into orchestrator |
| syncOrchestrator ↔ filterEngine | Direct function call | filterEngine returns filtered event list |
| syncOrchestrator ↔ gcalSync | Direct function call | gcalSync extended to accept an explicit `google.calendar` client |
| syncOrchestrator ↔ icalParser | Direct function call | icalParser unchanged |
| API routes ↔ DB | Drizzle ORM queries via `lib/db.ts` | Services do not import `lib/db.ts` directly; they receive db as a parameter for testability |
| Cron route ↔ manual sync route | Both call `syncOrchestrator` — no shared HTTP | Keep sync logic in `syncOrchestrator.ts`, not inline in route handlers |

## Build Order Implications

The component dependencies create a clear build sequence:

1. **Database schema + migration** — Everything else depends on persistent state.
2. **Auth.js integration** (`lib/auth.ts`, `/api/auth/[...nextauth]`) — Tokens cannot be stored or retrieved without the auth layer and DB adapter.
3. **`tokenStore.ts`** — Depends on DB and Auth.js account records. Blocks the orchestrator.
4. **`filterEngine.ts`** — Depends on DB (preferences schema). Can be built in parallel with `tokenStore`.
5. **Extend `gcalSync.ts`** to accept an explicit calendar client — Small change, unblocks the orchestrator.
6. **`syncOrchestrator.ts`** — Assembles all services. Requires tokenStore, filterEngine, icalParser, gcalSync.
7. **Manual sync API route** (`/api/sync`) — Thin wrapper over orchestrator. Quick to build once orchestrator exists.
8. **Cron route** (`/api/cron/sync`) — Same orchestrator call, adds CRON_SECRET check + multi-user loop.
9. **Preferences API + UI** — Can be built in parallel after DB schema; filter settings are read by orchestrator but the UI is independent.
10. **AccountLinkStatus + SyncStatus UI components** — Built last; they consume the already-working backend.

## Sources

- [Vercel Cron Jobs — Official Docs](https://vercel.com/docs/cron-jobs) — HIGH confidence
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — HIGH confidence (security pattern, idempotency requirement, duration limits)
- [Vercel Cron Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — HIGH confidence (Hobby: once/day; Pro: once/minute)
- [NextAuth.js Account Linking Discussion](https://github.com/nextauthjs/next-auth/discussions/1702) — MEDIUM confidence (community-documented, not official API)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) — HIGH confidence
- [Auth.js Pg Adapter](https://authjs.dev/getting-started/adapters/pg) — HIGH confidence
- [Neon + Vercel Integration](https://vercel.com/marketplace/neon) — HIGH confidence
- [NextAuth.js FAQ on token storage](https://next-auth.js.org/faq) — HIGH confidence (DB adapter vs JWT session trade-offs)

---
*Architecture research for: Canvas-to-GCal multi-account OAuth + scheduled sync*
*Researched: 2026-03-11*

# Phase 3: Reliability and Deploy - Research

**Researched:** 2026-03-12
**Domain:** UI feedback (timestamps + sync summaries), error messaging, Vercel deployment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-02 | App displays last synced timestamp | localStorage persistence in client component; store epoch ms after each successful sync completion |
| SYNC-03 | After sync, shows summary (X created, Y updated, Z skipped/failed) | Already implemented in SyncSummary.tsx and returned by /api/sync/status; gap is the timestamp wire-up and DB-persistence path |
| SYNC-04 | Clear error messages when auth fails, feed is invalid, or API quota is hit | Google Calendar API returns distinct error codes (401 authError, 403 rateLimitExceeded/quotaExceeded, network failure); classify these in runSyncJob and surface as actionable strings |
</phase_requirements>

---

## Summary

Phase 3 has three concerns: (1) surfacing a "last synced at" timestamp to the user, (2) ensuring the existing sync summary mechanism works end-to-end with actionable error classification, and (3) getting the app live at a public HTTPS URL on Vercel.

The sync summary UI (`SyncSummary.tsx`) and the polling mechanism (`SyncDashboard.tsx`) are already built and wire up `canvasSummary` and `mirrorSummary` from the job state. The primary gap for SYNC-02 and SYNC-03 is persisting a timestamp after sync completion. The cleanest option for this single-user personal-account app is `localStorage` — store the epoch millisecond when the status poll returns `complete`, then read and format it on mount. No schema migration needed.

For SYNC-04, the existing catch in `runSyncJob` serialises any thrown `Error.message` as a generic string. The three failure modes that matter — expired auth token, invalid/unreachable Canvas ICS URL, and Google Calendar API quota/rate-limit — each produce recognisably different error payloads from the googleapis client. Classifying them at the `runSyncJob` level and mapping them to user-facing strings before storing in `job.error` is the right insertion point.

Deployment to Vercel is the lowest-risk part of this phase. The project has no build errors currently (standard Next.js App Router, Neon Postgres, no custom server). The required work is: connect GitHub repo to Vercel, add 7 environment variables in the Vercel dashboard, verify production OAuth redirect URIs in Google Cloud Console, and publish the OAuth app (not leave it in Testing mode, per the existing blocker documented in STATE.md).

**Primary recommendation:** Wire localStorage timestamp into SyncDashboard's poll-complete handler, classify error types in runSyncJob, then deploy to Vercel with environment variable transfer and OAuth app publication.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework, build output | Already in use |
| Vercel | platform | Hosting | Zero-config for Next.js; auto-detects App Router |
| localStorage | browser API | Persist last-sync timestamp across reloads | No server needed for display-only state |
| Neon Postgres | @neondatabase/serverless ^1.0.2 | Token + user storage (no change) | Already in use |
| Drizzle ORM | ^0.45.1 | DB queries (no change) | Already in use |

### No New Dependencies Required

This phase adds no npm packages. All work is:
- UI state management (existing React `useState`/`useEffect` patterns already in `SyncDashboard.tsx`)
- Error classification (string matching on existing Error objects from googleapis)
- Platform configuration (Vercel dashboard + Google Cloud Console)

---

## Architecture Patterns

### Recommended Project Structure (no change to existing)

```
src/
├── app/api/sync/route.ts       # classify errors here (runSyncJob catch block)
├── components/SyncDashboard.tsx # persist timestamp here (poll complete handler)
├── components/SyncSummary.tsx   # already shows summary cards (no change needed)
└── components/SyncButton.tsx    # already shows error string (no change needed)
```

### Pattern 1: localStorage Last-Sync Timestamp

**What:** On poll completion (status === 'complete'), write `Date.now()` to `localStorage`. On component mount, read and format it as a relative or absolute string.

**When to use:** Display-only state that must survive page reload but needs no server roundtrip.

**Key constraints:**
- Must be inside `useEffect` (localStorage is browser-only; Next.js SSR will throw if accessed synchronously at module level)
- Initialize state to `null`, not a real value, to avoid hydration mismatch between server render and first client render
- Use `typeof window !== 'undefined'` guard if reading outside `useEffect`

**Example:**
```typescript
// In SyncDashboard.tsx (client component — already 'use client')
const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

// On mount, restore from localStorage
useEffect(() => {
  const stored = localStorage.getItem('lastSyncedAt');
  if (stored) setLastSyncedAt(Number(stored));
}, []);

// In poll-complete handler (inside handleSync, after setSyncStatus('complete'))
const now = Date.now();
localStorage.setItem('lastSyncedAt', String(now));
setLastSyncedAt(now);

// Render
{lastSyncedAt && (
  <p className="text-xs text-[--color-text-secondary]">
    Last synced {new Date(lastSyncedAt).toLocaleString()}
  </p>
)}
```

### Pattern 2: Actionable Error Classification in runSyncJob

**What:** Inspect the caught error's message or response status from the googleapis client before assigning `job.error`. Map to user-facing strings that tell the user what to do next.

**Google Calendar API error signals (HIGH confidence — verified via official docs):**

| Condition | googleapis error message contains | HTTP status | User-facing message |
|-----------|----------------------------------|-------------|---------------------|
| Expired/invalid access token (getFreshAccessToken returns null) | No API call made — `getFreshAccessToken` returns `null` | — | "Your Google account connection has expired. Please reconnect." |
| googleapis throws with 401 | "Invalid Credentials" or "invalid_grant" | 401 | "Your Google account connection has expired. Please reconnect." |
| Rate limit or quota exceeded | "User Rate Limit Exceeded" / "rateLimitExceeded" / "quotaExceeded" / "Calendar usage limits exceeded" | 403 or 429 | "Google Calendar quota exceeded. Please try again in a few minutes." |
| Canvas ICS URL unreachable/malformed | Network error / non-200 from `parseCanvasFeed` | — | "Could not fetch your Canvas feed. Check that the ICS URL is still valid." |

**Implementation approach:** The current `runSyncJob` catch block already sets `job.error`. Add a `classifyError(err: unknown): string` helper that pattern-matches the error and returns the right user string. This keeps `runSyncJob` clean.

```typescript
// In src/app/api/sync/route.ts
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('invalid credentials') || lower.includes('invalid_grant') ||
      msg.includes('No access token available')) {
    return 'Your Google account connection has expired. Go to Settings and reconnect your account.';
  }
  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('usagelimits')) {
    return 'Google Calendar quota exceeded. Please wait a few minutes and try again.';
  }
  if (lower.includes('canvas') || lower.includes('ics') || lower.includes('fetch')) {
    return 'Could not fetch your Canvas feed. Check that the ICS URL is still valid in Settings.';
  }
  return `Sync failed: ${msg}`;
}
```

### Pattern 3: Vercel Deployment

**What:** Connect GitHub repo, configure environment variables, verify OAuth redirect URIs, publish OAuth app.

**Steps:**
1. Push repo to GitHub (if not already done)
2. Vercel dashboard → "Add New Project" → Import from GitHub
3. Vercel auto-detects Next.js — accept default build settings (`npm run build`, output `.next`)
4. Add all 7 environment variables in Vercel → Settings → Environment Variables (Production only for secrets)
5. Trigger first deploy
6. Copy production URL (e.g., `https://coursemap.vercel.app`)
7. Add production URL callback to Google Cloud Console OAuth app:
   - `https://<your-domain>/login/google/callback`
   - `https://<your-domain>/link/school-google/callback`
8. Publish OAuth app to Production status (critical — Testing mode causes 7-day refresh token expiry)

### Anti-Patterns to Avoid

- **Accessing localStorage synchronously at component top level:** Throws during SSR. Always use `useEffect`.
- **Storing timestamp in React state only (no localStorage):** Loses timestamp on page reload — defeats SYNC-02.
- **Generic error messages like "Sync failed":** SYNC-04 explicitly requires specific, actionable messages. Map error types before storing in `job.error`.
- **Leaving OAuth app in Testing mode on production:** Documented blocker in STATE.md. Refresh tokens expire after 7 days, silently breaking sync for users who don't log in frequently.
- **Fire-and-forget sync route timing out on Vercel:** The existing implementation fires the sync as a void promise that runs after the 202 response. On Vercel, functions terminate when the response is sent UNLESS the function runtime keeps the process alive. This is a real risk (see Pitfalls section).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTPS / TLS | Custom cert management | Vercel provides HTTPS automatically | TLS on Vercel is provisioned for free per deployment |
| Timestamp formatting | Custom date formatter | `Date.toLocaleString()` or `Intl.DateTimeFormat` | Already in browser API |
| Persistent cross-session state for a display value | Database column | localStorage | No query needed; user-scoped; acceptable loss on cache clear |
| Error classification regex | Third-party error library | Plain string matching on `err.message` | The error set is small and stable; over-engineering kills momentum |

---

## Common Pitfalls

### Pitfall 1: Fire-and-Forget Void Promise Termination on Vercel

**What goes wrong:** `void runSyncJob(...)` is launched after the `202` response is sent. On serverless platforms, the process may be frozen or recycled immediately after a response is sent, killing the background work mid-sync.

**Why it happens:** Vercel serverless functions are scoped to a request/response lifecycle. Node.js `void` promises that outlive the response are not guaranteed to complete.

**How to avoid:** Vercel supports `waitUntil` via the `after()` API introduced in Next.js 15. Use `import { after } from 'next/server'` and call `after(runSyncJob(...))` instead of `void runSyncJob(...)`. This registers the work with Vercel's platform-level lifecycle extension.

```typescript
// next/server after() — Next.js 15 built-in (no extra package)
import { after } from 'next/server';
// ...
after(runSyncJob(jobId, userId, user.canvasIcsUrl));
return NextResponse.json({ jobId }, { status: 202 });
```

The current in-memory `syncJobs` Map will still be lost on function cold-start. For the manual-sync use case this is acceptable (documented decision in STATE.md: "progress loss on restart is acceptable").

**Warning signs:** Sync starts (202 returned, jobId received), but polling /api/sync/status always returns 404 immediately on production even though it works locally.

**Confidence:** MEDIUM — `after()` behavior on Vercel Hobby is documented but not fully field-tested against the specific in-memory Map pattern. Validate in first deploy.

### Pitfall 2: In-Memory syncJobs Map Not Shared Across Vercel Instances

**What goes wrong:** Vercel can spin up multiple function instances. A POST to `/api/sync` (which sets `syncJobs[jobId]`) may land on Instance A, but the subsequent GET to `/api/sync/status?jobId=...` may land on Instance B, which has no record of that jobId — returns 404.

**Why it happens:** Serverless functions are stateless. In-memory state is per-instance.

**How to avoid:** For this phase (manual sync only), this is an edge case that's unlikely to cause frequent failures on a Hobby plan with a single user. The STATE.md decision ("In-memory syncJobs Map with 5-minute TTL: acceptable for manual sync") still holds for a single-user app. Document the known limitation. If it becomes a real issue post-deploy, the fix is replacing the Map with a single DB row (`sync_jobs` table with status/summary columns).

**Warning signs:** Polling returns 404 intermittently in production but never locally.

### Pitfall 3: OAuth Redirect URI Mismatch After Deploy

**What goes wrong:** Logging in on the production URL fails with OAuth error because only `localhost:3000` callbacks are registered in Google Cloud Console.

**Why it happens:** Google validates redirect_uri against the list registered in the Cloud Console project.

**How to avoid:** Add both production callback URIs to the OAuth app before testing login in production:
- `https://<domain>/login/google/callback`
- `https://<domain>/link/school-google/callback`

### Pitfall 4: localStorage Hydration Mismatch

**What goes wrong:** Server renders `null` for `lastSyncedAt`. Client reads localStorage and has a real timestamp. React throws a hydration warning or the UI flickers.

**Why it happens:** Server has no access to localStorage; client does. If state is initialized from localStorage before hydration, the two renders disagree.

**How to avoid:** Initialize `lastSyncedAt` state to `null`. Only read from localStorage inside `useEffect` (runs client-side only, after hydration). Render the timestamp only when state is non-null.

### Pitfall 5: NEXT_PUBLIC_ Variable Exposure

**What goes wrong:** Server-side secrets (TOKEN_ENCRYPTION_KEY, DATABASE_URL, GOOGLE_CLIENT_SECRET) accidentally given NEXT_PUBLIC_ prefix and bundled into client JS.

**Why it happens:** Developers copy env var names without checking prefix rules.

**How to avoid:** Audit all env vars before adding to Vercel. None of the existing vars need NEXT_PUBLIC_. No client-side env vars are required for this app.

---

## Code Examples

### Reading and Writing Last-Sync Timestamp Safely

```typescript
// Source: https://nextjs.org/docs/app/getting-started/server-and-client-components
// and https://sentry.io/answers/referenceerror-localstorage-is-not-defined-in-next-js/

// CORRECT: Read in useEffect, initialize to null
const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

useEffect(() => {
  const stored = localStorage.getItem('lastSyncedAt');
  if (stored) setLastSyncedAt(Number(stored));
}, []);

// CORRECT: Write when sync completes
const now = Date.now();
localStorage.setItem('lastSyncedAt', String(now));
setLastSyncedAt(now);

// CORRECT: Render conditionally
{lastSyncedAt !== null && (
  <p>Last synced: {new Date(lastSyncedAt).toLocaleString()}</p>
)}
```

### Using after() for Background Work in Next.js 15

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/after
import { after } from 'next/server';

export async function POST() {
  // ... session check, jobId creation, syncJobs.set ...
  after(runSyncJob(jobId, userId, user.canvasIcsUrl));
  return NextResponse.json({ jobId }, { status: 202 });
}
```

### Vercel Environment Variables for This Project

All 7 required env vars (set in Vercel → Settings → Environment Variables → Production):

```
DATABASE_URL                 (Neon connection string — pooled)
TOKEN_ENCRYPTION_KEY         (32-byte base64 secret)
SESSION_SECRET               (JWT signing secret)
GOOGLE_CLIENT_ID             (OAuth client ID)
GOOGLE_CLIENT_SECRET         (OAuth client secret)
GOOGLE_SCHOOL_CLIENT_ID      (school OAuth client ID, if separate)
GOOGLE_SCHOOL_CLIENT_SECRET  (school OAuth client secret, if separate)
ANTHROPIC_API_KEY            (AI title cleanup — already in dependencies)
```

Note: Verify exact variable names against `src/lib/auth.ts` and `src/lib/tokens.ts` — the above names are derived from typical patterns; the actual names in .env.local must match exactly.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `void` fire-and-forget | `after()` from `next/server` | Next.js 15 | Guarantees background task completes after response on Vercel |
| Vercel Hobby 10s timeout | Vercel Hobby 300s (fluid compute) | ~2024 | A full sync of 100+ events is safe within 5 minutes |
| Manual HTTPS cert | Vercel auto-provisions TLS | Always | Zero config needed |

**Deprecated/outdated:**
- `waitUntil(promise)` from `@vercel/edge` — replaced by `after()` in Next.js 15 for App Router route handlers

---

## Open Questions

1. **Exact environment variable names**
   - What we know: `src/lib/tokens.ts` reads `TOKEN_ENCRYPTION_KEY`; `src/lib/auth.ts` likely reads `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - What's unclear: Whether school OAuth uses a separate client ID/secret pair or the same one with a different redirect URI; whether `ANTHROPIC_API_KEY` is already in `.env.local`
   - Recommendation: Read `src/lib/auth.ts` during planning to enumerate exact `process.env.*` references; do not guess

2. **after() availability on this Next.js version**
   - What we know: `after()` was introduced in Next.js 15 (experimental, then stable). Project is on `16.1.6`.
   - What's unclear: Whether version 16.1.6 exports `after` from `next/server` stably (version numbering jumped significantly, may be a pre-release)
   - Recommendation: During planning, test `import { after } from 'next/server'` compiles without error; fall back to `void` with a comment if not available

3. **syncJobs Map vs. multi-instance problem**
   - What we know: In-memory Map is per-instance; Vercel can route requests to different instances
   - What's unclear: At Hobby plan single-user scale, how often this actually triggers
   - Recommendation: Accept the risk for this phase per the STATE.md decision; plan a fallback (DB-backed sync status row) as a quick-fix task if it breaks in production

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --testPathPattern="sync" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-02 | lastSyncedAt persists to localStorage and is read on mount | unit | `npx jest --testPathPattern="SyncDashboard" --no-coverage` | Wave 0 |
| SYNC-03 | Sync summary (created/updated/skipped/failed) displayed after sync | unit | `npx jest --testPathPattern="SyncSummary" --no-coverage` | Wave 0 |
| SYNC-04 | Expired auth returns specific user-facing message | unit | `npx jest --testPathPattern="sync/route" --no-coverage` | Wave 0 |
| SYNC-04 | Quota exceeded returns specific user-facing message | unit | `npx jest --testPathPattern="sync/route" --no-coverage` | Wave 0 |
| SYNC-04 | Invalid Canvas ICS URL returns specific user-facing message | unit | `npx jest --testPathPattern="sync/route" --no-coverage` | Wave 0 |

Note: SYNC-03 summary display is substantially covered by the existing `gcalSync.test.ts` and `schoolMirror.test.ts` which verify summary counts. The gap is a component-level test for `SyncSummary.tsx` rendering the counts and the route-level test for `classifyError`.

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="sync" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/SyncSummary.test.tsx` — covers SYNC-03 (renders canvas/mirror summary counts)
- [ ] `src/components/__tests__/SyncDashboard.test.tsx` — covers SYNC-02 (localStorage read on mount, write on sync complete)
- [ ] `src/app/api/sync/__tests__/route.test.ts` — covers SYNC-04 (classifyError maps auth/quota/canvas errors to actionable strings)

---

## Sources

### Primary (HIGH confidence)

- Vercel Functions Limits (official) — https://vercel.com/docs/functions/limitations — timeout limits, memory, Hobby plan defaults
- Google Calendar API Errors (official) — https://developers.google.com/workspace/calendar/api/guides/errors — 401/403/429 error codes and messages
- Next.js Server and Client Components (official) — https://nextjs.org/docs/app/getting-started/server-and-client-components — localStorage patterns, SSR constraints
- Project source: `src/app/api/sync/route.ts` — existing job state, fire-and-forget pattern
- Project source: `src/components/SyncDashboard.tsx` — existing polling, summary state
- Project source: `src/components/SyncSummary.tsx` — existing summary display

### Secondary (MEDIUM confidence)

- Vercel + Neon integration guide — https://neon.com/docs/guides/vercel-manual — env var naming and pooled vs. unpooled connections
- Vercel GitHub integration — https://vercel.com/docs/git/vercel-for-github — deploy process
- Sentry: localStorage is not defined in Next.js — https://sentry.io/answers/referenceerror-localstorage-is-not-defined-in-next-js/ — SSR-safe localStorage access pattern

### Tertiary (LOW confidence)

- WebSearch results re: `after()` behavior at Vercel Hobby scale — not independently verified against Next.js 16 changelog; treat as needing validation during planning

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing libraries already in use
- Architecture: HIGH — localStorage pattern is well-documented; error classification is straightforward string matching; Vercel deploy process is standard
- Pitfalls: HIGH for OAuth/env var issues (documented in STATE.md blockers); MEDIUM for `after()` vs. `void` serverless behavior (needs validation at planning time)
- Validation architecture: HIGH — existing Jest infrastructure is complete; only test file gaps need creation in Wave 0

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (Vercel limits and Next.js APIs are stable)

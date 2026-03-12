---
phase: 01-auth-foundation
plan: "02"
subsystem: auth
tags: [arctic, oauth2, google-oauth, pkce, next-js, middleware, drizzle, aes-256-gcm, typescript, jest]

# Dependency graph
requires:
  - phase: 01-auth-foundation
    plan: "01"
    provides: "Drizzle schema (users, oauthTokens), encryptToken/decryptToken, setSessionCookie/getSession/clearSessionCookie, db client"
provides:
  - "Arctic Google OAuth clients (googleClient + googleSchoolClient) with PKCE"
  - "Personal Google login flow: /login/google → /login/google/callback (upserts user, stores encrypted tokens with email)"
  - "School Google link flow: /link/school-google → /link/school-google/callback (stores role=school tokens with school email for existing user)"
  - "POST /api/auth/signout — clears tokens, deletes user row, clears session cookie"
  - "getFreshAccessToken(userId, role) — returns cached or refreshed access token, returns null on failure"
  - "Next.js middleware — redirects unauthenticated users to /, authenticated users away from /login to /dashboard"
  - "School callback unit tests (6 tests)"
affects:
  - 02-sync-features
  - 03-ui-components

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Arctic PKCE OAuth: generateState + generateCodeVerifier stored in httpOnly cookies (maxAge 10min, sameSite lax), validated on callback"
    - "Dual-client pattern: googleClient (personal, /login/google/callback) + googleSchoolClient (school, /link/school-google/callback)"
    - "Refresh token preservation: if hasRefreshToken() is false, query existing row and preserve encryptedRefreshToken before upsert"
    - "Cookie namespacing: login flow uses oauth_state/code_verifier, school link flow uses link_oauth_state/link_code_verifier"
    - "Optimistic middleware: reads session JWT from cookie for redirect decisions; sensitive API routes still verify server-side"

key-files:
  created:
    - src/lib/auth.ts
    - src/app/login/google/route.ts
    - src/app/login/google/callback/route.ts
    - src/app/link/school-google/route.ts
    - src/app/link/school-google/callback/route.ts
    - src/app/api/auth/signout/route.ts
    - src/middleware.ts
    - src/app/link/__tests__/school-callback.test.ts
  modified:
    - src/lib/tokens.ts
    - src/lib/__tests__/tokens.test.ts

key-decisions:
  - "Two Google client instances required: Arctic's Google class binds the redirect_uri at construction time, so personal and school flows must use separate instances"
  - "getFreshAccessToken uses 5-minute expiry buffer before refresh to avoid using nearly-expired tokens in API calls"
  - "Signout deletes user row explicitly (cascade handles tokens, but explicit delete is clearer per code review)"
  - "Middleware excludes /api/* from matcher — route handlers verify session server-side, preventing CVE-2025-29927 bypass pattern"

patterns-established:
  - "OAuth cookie pattern: store state+verifier in httpOnly cookies, delete them after callback completes"
  - "Refresh token preservation: always query existing row before upsert when hasRefreshToken() may be false"
  - "Test isolation: jest.mock for @/lib/db and @/lib/auth needed in tokens.test.ts to prevent Neon/OAuth client initialization at import time"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04]

# Metrics
duration: 22min
completed: 2026-03-12
---

# Phase 1 Plan 02: OAuth Route Handlers, Token Refresh, and Middleware Summary

**Arctic PKCE Google OAuth with dual-client personal/school flows, AES-256-GCM token storage, transparent access token refresh, and Next.js optimistic session middleware**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-12T16:50:27Z
- **Completed:** 2026-03-12T17:12:00Z
- **Tasks:** 2
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- Full personal Google OAuth flow: /login/google generates PKCE auth URL with calendar scope, callback upserts user row and stores encrypted tokens (with email) in oauthTokens, sets session cookie
- School Google link flow: requires authenticated session, uses calendar.readonly scope with select_account prompt, callback stores role=school tokens with school email — never creates a new user
- getFreshAccessToken transparently returns cached token if fresh (>5 min buffer), refreshes via Google OAuth if expired, returns null if refresh fails (caller shows ReconnectBanner)
- Next.js middleware protects non-public routes (redirects unauthenticated to /, authenticated users away from /login to /dashboard); excludes /api from matcher per CVE-2025-29927 guidance
- 6 school callback unit tests pass: role=school insert with email, no user creation, session guard, error redirect, cookie cleanup, refresh token preservation

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth lib, OAuth route handlers, school callback test** - `cc6d620` (feat)
2. **Task 2: getFreshAccessToken and Next.js middleware** - `0288c86` (feat)

## Files Created/Modified

- `src/lib/auth.ts` - Arctic Google clients (googleClient + googleSchoolClient), re-exports generateState/generateCodeVerifier
- `src/app/login/google/route.ts` - Personal OAuth initiation: PKCE state+verifier in httpOnly cookies, redirects to Google
- `src/app/login/google/callback/route.ts` - Personal callback: validates state, exchanges code, upserts user + oauthTokens (role=personal), stores email, preserves existing refresh token
- `src/app/link/school-google/route.ts` - School link initiation: requires session, calendar.readonly scope, select_account prompt, link_ cookie prefix
- `src/app/link/school-google/callback/route.ts` - School callback: validates state+session, stores role=school tokens with school email for existing user only
- `src/app/api/auth/signout/route.ts` - POST handler: deletes tokens + user row, clears session cookie, returns JSON {success: true}
- `src/middleware.ts` - Optimistic session check; protects non-public paths; excludes api/_next/static from matcher
- `src/app/link/__tests__/school-callback.test.ts` - 6 unit tests for school callback handler
- `src/lib/tokens.ts` - Added getFreshAccessToken function (cache check, refresh, DB update)
- `src/lib/__tests__/tokens.test.ts` - Added jest.mock for @/lib/db and @/lib/auth (bug fix)

## Decisions Made

- **Two Google client instances:** Arctic's `Google` class encodes the `redirect_uri` at construction. Since the personal and school flows use different redirect URIs, two instances (`googleClient` + `googleSchoolClient`) are required. They share the same `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- **5-minute refresh buffer:** `getFreshAccessToken` refreshes when `accessTokenExpiresAt <= now + 5min`. This prevents API calls being made with a token that may expire mid-request.
- **Middleware excludes /api:** Following CVE-2025-29927 guidance, middleware is explicitly documented as optimistic only. API routes must verify session server-side. The matcher excludes `/api/` paths entirely to reinforce this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tokens.test.ts broke after adding db/auth imports to tokens.ts**
- **Found during:** Task 2 (after adding getFreshAccessToken with top-level imports)
- **Issue:** The existing tokens unit tests import `tokens.ts` which now imports `@/lib/db` and `@/lib/auth` at module scope. Neon's HTTP client initializes immediately on import and throws when `DATABASE_URL` is not set in the test environment.
- **Fix:** Added `jest.mock("@/lib/db", ...)` and `jest.mock("@/lib/auth", ...)` before the dynamic import in `tokens.test.ts`. The mocks return stub objects so the module loads without real DB/OAuth initialization.
- **Files modified:** `src/lib/__tests__/tokens.test.ts`
- **Verification:** All 14 Plan 01 tests pass after fix (tokens: 4, session: 4, schema: 6)
- **Committed in:** `0288c86` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Auto-fix necessary to maintain test suite integrity. No scope creep. The root cause is a common pattern in this codebase — any module that imports db/auth needs mocks in its test file.

## Issues Encountered

- Pre-existing failure in `src/services/icalParser.test.ts` (TypeError on `ical.default.async`) was present before this plan and is out of scope. Logged to deferred items.

## User Setup Required

Before the OAuth flows can be tested end-to-end, Google Cloud Console must be configured:

1. Create OAuth 2.0 Client ID (Web application type) at: Google Cloud Console → APIs & Services → Credentials
2. Add authorized redirect URIs:
   - `http://localhost:3000/login/google/callback`
   - `http://localhost:3000/link/school-google/callback`
3. Enable Google Calendar API at: Google Cloud Console → APIs & Services → Library
4. Add to `.env.local`:
   - `GOOGLE_CLIENT_ID=<your-client-id>`
   - `GOOGLE_CLIENT_SECRET=<your-client-secret>`
   - `NEXT_PUBLIC_BASE_URL=http://localhost:3000` (optional, defaults to localhost:3000)

## Next Phase Readiness

- Complete auth layer is ready: login, link school, signout, token refresh, route protection all implemented
- Route handlers can be tested end-to-end once Google OAuth credentials are configured in `.env.local`
- `getFreshAccessToken` is ready for use in Phase 2 sync features (Canvas ICS fetch, Google Calendar write)
- Blocker from Phase 1: Google OAuth app should be published to Production status before deploying (Testing mode causes 7-day refresh token expiry)

## Self-Check: PASSED

All files confirmed present:
- FOUND: src/lib/auth.ts
- FOUND: src/app/login/google/route.ts
- FOUND: src/app/login/google/callback/route.ts
- FOUND: src/app/link/school-google/route.ts
- FOUND: src/app/link/school-google/callback/route.ts
- FOUND: src/app/api/auth/signout/route.ts
- FOUND: src/middleware.ts
- FOUND: src/app/link/__tests__/school-callback.test.ts
- FOUND: src/lib/tokens.ts (modified)

Task commits confirmed in git log:
- `cc6d620` feat(01-02): create auth lib, OAuth route handlers, and school callback test
- `0288c86` feat(01-02): add getFreshAccessToken and Next.js route protection middleware

---
*Phase: 01-auth-foundation*
*Completed: 2026-03-12*

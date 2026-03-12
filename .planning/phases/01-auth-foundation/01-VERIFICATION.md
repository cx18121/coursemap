---
phase: 01-auth-foundation
verified: 2026-03-12T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "End-to-end personal Google sign-in flow"
    expected: "Visiting / shows wizard Step 1. Clicking 'Sign in with Google' redirects to Google consent. After auth, wizard advances to Step 2."
    why_human: "OAuth consent screen redirect and cookie exchange cannot be verified without a live browser and real Google credentials"
  - test: "School Google account linking"
    expected: "From Step 2, clicking 'Link School Account' redirects to Google with select_account prompt. After auth, wizard advances to Step 3."
    why_human: "Requires live session cookie, second Google account, and actual OAuth round-trip"
  - test: "Session persistence across browser restart"
    expected: "Closing and reopening the browser with a valid session cookie returns the user to /dashboard directly, not to the wizard."
    why_human: "Cookie persistence behavior (httpOnly, maxAge=30 days) requires actual browser verification"
  - test: "Silent token refresh"
    expected: "When access token is expired but refresh token is valid, getFreshAccessToken transparently returns a new token without user action, and no ReconnectBanner appears."
    why_human: "Requires expired token in a live DB row and a real Google OAuth refresh call"
---

# Phase 1: Auth Foundation Verification Report

**Phase Goal:** Users can securely connect both Google accounts and stay connected across sessions
**Verified:** 2026-03-12
**Status:** human_needed — all automated checks passed; 4 items require live browser testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | User can sign in with personal Google account via OAuth consent flow | VERIFIED | `/login/google/route.ts` generates PKCE auth URL with `openid email profile calendar` scopes; callback at `/login/google/callback/route.ts` validates state, exchanges code, upserts user row, calls `setSessionCookie` |
| 2 | After signing in, user can link a second school Google account from same session | VERIFIED | `/link/school-google/route.ts` calls `getSession()` and returns 401 if null; callback stores `role=school` token row without creating new user; 6 passing unit tests cover the school callback |
| 3 | Both account connections persist after closing and reopening the browser | VERIFIED | Session cookie set with `httpOnly: true, maxAge: 2592000` (30 days); tokens stored AES-256-GCM encrypted in `oauth_tokens` DB table; `getSession()` decrypts JWT from cookie on every request |
| 4 | Accessing app with expired token does not break session — tokens refresh silently | VERIFIED | `getFreshAccessToken` in `tokens.ts` (lines 51-96): checks 5-min expiry buffer, calls `googleClient.refreshAccessToken`, updates DB row, returns new token; returns `null` on failure so `ReconnectBanner` is shown instead of crashing |

**Score: 4/4 success criteria verified**

---

### Observable Truths (Plan-level must_haves)

#### Plan 01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Drizzle schema defines users, oauth_tokens tables with correct columns | VERIFIED | `src/lib/db/schema.ts` exports both tables; `oauth_tokens` has `email`, unique index on `(userId, role)` via `uniqueIndex("oauth_tokens_user_role_idx")`; migration SQL confirms all columns |
| 2 | Token encryption round-trips correctly | VERIFIED | `encryptToken`/`decryptToken` in `tokens.ts` using AES-256-GCM; 4 unit tests in `tokens.test.ts` cover round-trip, format, tamper detection, random IV |
| 3 | Session encrypt/decrypt round-trips correctly (JWT contains userId) | VERIFIED | `encryptSession`/`decryptSession` in `session.ts` using `jose` HS256; 5 unit tests in `session.test.ts` cover round-trip, null on garbage, exp field |
| 4 | DB client connects to Neon via HTTP driver | VERIFIED | `src/lib/db/index.ts`: `drizzle(process.env.DATABASE_URL!, { schema })` using `drizzle-orm/neon-http` |
| 5 | Schema exports are valid and constraint structure correct | VERIFIED | `schema.test.ts` has 5 structural tests: table exports, column presence, unique constraint check |

#### Plan 02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting /login/google redirects to Google OAuth consent with correct scopes | VERIFIED | `login/google/route.ts` calls `googleClient.createAuthorizationURL` with `openid,email,profile,calendar`, sets `access_type=offline`, returns `NextResponse.redirect` |
| 2 | Google callback exchanges code, creates user, stores encrypted tokens, sets session cookie | VERIFIED | `login/google/callback/route.ts`: validates state, calls `validateAuthorizationCode`, upserts `users` and `oauthTokens` with `encryptToken`, calls `setSessionCookie(user.id)` |
| 3 | Visiting /link/school-google from authenticated session redirects with select_account | VERIFIED | `link/school-google/route.ts`: checks `getSession()`, sets `prompt=select_account`, uses `calendar.readonly` scope, uses `link_` prefixed cookies |
| 4 | School callback stores role=school for existing user, does not create new user | VERIFIED | `link/school-google/callback/route.ts`: only inserts into `oauthTokens`, no `users` insert; confirmed by school-callback.test.ts test "does NOT insert into users" |
| 5 | POST /api/auth/signout clears session cookie and DB tokens | VERIFIED | `api/auth/signout/route.ts`: deletes `oauthTokens` rows, deletes `users` row (cascade), calls `clearSessionCookie()` |
| 6 | Unauthenticated requests to protected paths redirect to / | VERIFIED | `middleware.ts`: checks `decryptSession`, redirects non-public paths to `/`; excludes `/api/` from matcher per CVE-2025-29927 guidance |
| 7 | getFreshAccessToken returns cached/refreshed token, null on failure | VERIFIED | `tokens.ts` lines 51-96: 5-min buffer check, refresh via `googleClient.refreshAccessToken`, DB update, null catch block |

#### Plan 03 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated user sees setup wizard at Step 1 | VERIFIED | `page.tsx`: no session → `currentStep=1`, renders `<SetupWizard currentStep={1} />`; wizard Step 1 shows "Sign in with Google" link to `/login/google` |
| 2 | After personal Google connected, wizard shows Step 2 with Skip option | VERIFIED | `page.tsx`: `personalConnected && !setupComplete` → `currentStep=2`; `SetupWizard` Step 2 has both "Link School Account" and "Skip for now" buttons |
| 3 | After Step 2 or skip, wizard shows Step 3 (Canvas ICS URL) | VERIFIED | `SetupWizard.tsx`: `handleSkipSchool = () => setStep(3)`; Step 3 renders URL input + "Save & Continue" button calling POST `/api/auth/canvas-url` |
| 4 | Wizard shows progress bar indicating current step | VERIFIED | `SetupWizard.tsx` lines 76-89: 3-segment progress bar, "Step {step} of 3" text |
| 5 | Returning user with valid session and completed setup goes to dashboard | VERIFIED | `page.tsx` lines 35-39: `if (setupComplete) redirect("/dashboard")`; `dashboard/page.tsx` also calls `getSession()` and redirects to `/` if null |
| 6 | Account dropdown shows connected accounts with email + role label | VERIFIED | `AccountDropdown.tsx`: fetches `/api/auth/me`, renders account rows with `{account.email}` and role badge ("Personal"/"School") |
| 7 | Account dropdown shows "Link school account" when school not connected | VERIFIED | `AccountDropdown.tsx` lines 98-108: `!schoolConnected` renders link to `/link/school-google` |
| 8 | Sign out clears everything and returns to wizard | VERIFIED | `AccountDropdown.tsx`: `handleSignOut` calls `fetch("/api/auth/signout", { method: "POST" })` then `window.location.href = "/"` |
| 9 | Token refresh failure shows non-blocking reconnect banner | VERIFIED | `ReconnectBannerWrapper.tsx`: fetches `/api/auth/me`, filters `reconnectNeeded===true`, renders `<ReconnectBanner>` per account; wired in `layout.tsx` before `{children}` |
| 10 | /api/auth/me returns reconnectNeeded flags | VERIFIED | `api/auth/me/route.ts` lines 29-42: calls `getFreshAccessToken` per account row, sets `reconnectNeeded: freshToken === null` |
| 11 | layout.tsx conditionally renders ReconnectBanner | VERIFIED | `layout.tsx` line 48: `<ReconnectBannerWrapper isAuthenticated={isAuthenticated} />` rendered unconditionally; wrapper handles null auth case internally |

---

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/lib/db/schema.ts` | — | 48 lines | VERIFIED | Both tables, email column, uniqueIndex |
| `src/lib/db/index.ts` | — | 4 lines | VERIFIED | Exports `db` via neon-http driver |
| `src/lib/tokens.ts` | — | 96 lines | VERIFIED | encryptToken, decryptToken, getFreshAccessToken all exported |
| `src/lib/session.ts` | — | 76 lines | VERIFIED | All 5 session functions exported |
| `src/lib/auth.ts` | — | 18 lines | VERIFIED | googleClient, googleSchoolClient, generateState, generateCodeVerifier |
| `drizzle.config.ts` | — | exists | VERIFIED | Drizzle Kit config present |
| `drizzle/0000_rapid_payback.sql` | — | exists | VERIFIED | CREATE TABLE for users + oauth_tokens with FK and unique index |
| `src/lib/__tests__/tokens.test.ts` | — | 64 lines | VERIFIED | 4 tests: round-trip, format, tamper, random IV |
| `src/lib/__tests__/session.test.ts` | — | 49 lines | VERIFIED | 5 tests: round-trip, null cases, exp field |
| `src/lib/db/__tests__/schema.test.ts` | — | 73 lines | VERIFIED | 5 structural tests for table exports and columns |
| `src/app/login/google/route.ts` | — | 42 lines | VERIFIED | GET handler, PKCE flow, redirects to Google |
| `src/app/login/google/callback/route.ts` | — | 122 lines | VERIFIED | GET handler, code exchange, user upsert, token storage |
| `src/app/link/school-google/route.ts` | — | 47 lines | VERIFIED | GET handler, session required, calendar.readonly scope |
| `src/app/link/school-google/callback/route.ts` | — | 111 lines | VERIFIED | GET handler, school token upsert, no user creation |
| `src/app/api/auth/signout/route.ts` | — | 24 lines | VERIFIED | POST handler, deletes tokens + user, clears cookie |
| `src/middleware.ts` | — | 66 lines | VERIFIED | decryptSession check, public path list, redirect logic |
| `src/app/link/__tests__/school-callback.test.ts` | — | 184 lines | VERIFIED | 6 tests: role=school insert, no user creation, session guard, error redirect, cookie cleanup, refresh preservation |
| `src/components/SetupWizard.tsx` | 80 | 214 | VERIFIED | 3-step wizard, progress bar, skip, Canvas URL save |
| `src/components/AccountDropdown.tsx` | 40 | 123 | VERIFIED | Accounts list, email+role, link school, sign out |
| `src/components/ReconnectBanner.tsx` | 20 | 49 | VERIFIED | Amber banner, reconnect link, dismiss button |
| `src/components/ReconnectBannerWrapper.tsx` | — | 56 lines | VERIFIED | Client wrapper, fetches /api/auth/me, renders banners |
| `src/app/page.tsx` | — | 94 lines | VERIFIED | Server Component, getSession, wizard or redirect |
| `src/app/dashboard/page.tsx` | — | 54 lines | VERIFIED | Protected page, getSession guard, welcome message |
| `src/app/layout.tsx` | — | 53 lines | VERIFIED | Conditional nav bar, AccountDropdown, ReconnectBannerWrapper |
| `src/app/api/auth/me/route.ts` | — | 58 lines | VERIFIED | GET handler, user + accounts + reconnectNeeded flags |
| `src/app/api/auth/canvas-url/route.ts` | — | 53 lines | VERIFIED | POST handler, URL validation, DB update |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/lib/db/index.ts` | `src/lib/db/schema.ts` | schema import | WIRED | Line 2: `import * as schema from "./schema"` |
| `src/lib/tokens.ts` | `process.env.TOKEN_ENCRYPTION_KEY` | AES key | WIRED | Line 9: `const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64")` |
| `src/lib/session.ts` | `process.env.SESSION_SECRET` | JWT signing | WIRED | Line 4: `const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)` |
| `login/google/callback/route.ts` | `src/lib/db/schema.ts` | upsert user and token rows | WIRED | Lines 60-69 (users insert), lines 92-112 (oauthTokens insert with onConflictDoUpdate) |
| `login/google/callback/route.ts` | `src/lib/session.ts` | setSessionCookie after auth | WIRED | Line 115: `await setSessionCookie(user.id)` |
| `login/google/callback/route.ts` | `src/lib/tokens.ts` | encrypt tokens before DB storage | WIRED | Lines 74, 79: `encryptToken(tokens.accessToken())` and `encryptToken(tokens.refreshToken())` |
| `link/school-google/callback/route.ts` | `src/lib/session.ts` | getSession to identify user | WIRED | Line 40: `const session = await getSession()` |
| `src/middleware.ts` | `src/lib/session.ts` | decryptSession for optimistic check | WIRED | Line 2 import, line 39: `await decryptSession(sessionToken)` |
| `src/lib/tokens.ts` | `src/lib/auth.ts` | getFreshAccessToken calls refreshAccessToken | WIRED | Line 76: `await googleClient.refreshAccessToken(refreshToken)` |
| `src/components/SetupWizard.tsx` | `/login/google` | anchor href for personal sign-in | WIRED | Line 103: `href="/login/google"` |
| `src/components/SetupWizard.tsx` | `/link/school-google` | anchor href for school linking | WIRED | Line 152: `href="/link/school-google"` |
| `src/components/AccountDropdown.tsx` | `/api/auth/signout` | fetch POST on sign out | WIRED | Line 46: `fetch("/api/auth/signout", { method: "POST" })` |
| `src/components/AccountDropdown.tsx` | `/api/auth/me` | fetch GET for account status | WIRED | Line 29: `fetch("/api/auth/me")` |
| `src/app/page.tsx` | `src/lib/session.ts` | getSession to determine auth state | WIRED | Line 2 import, line 18: `await getSession()` |
| `src/app/layout.tsx` | `src/components/ReconnectBanner.tsx` | conditionally renders via wrapper | WIRED | Line 48: `<ReconnectBannerWrapper isAuthenticated={isAuthenticated} />`; wrapper imports and renders `ReconnectBanner` |
| `src/app/api/auth/me/route.ts` | `src/lib/tokens.ts` | getFreshAccessToken for reconnect detection | WIRED | Line 6 import, line 31: `await getFreshAccessToken(session.userId, row.role)` |

---

### Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| AUTH-01 | User can sign in with personal Google account via OAuth | 01-01, 01-02, 01-03 | SATISFIED | PKCE OAuth flow: `/login/google` → `/login/google/callback`; user upserted in DB; session cookie set; wizard Step 1 links to the flow |
| AUTH-02 | User can link school Google account as second OAuth connection | 01-02, 01-03 | SATISFIED | `/link/school-google` requires authenticated session; stores `role=school` token row; wizard Step 2 links to the flow; 6 unit tests verify behavior |
| AUTH-03 | OAuth tokens persist across sessions (encrypted storage) | 01-01, 01-03 | SATISFIED | AES-256-GCM encrypted tokens in `oauth_tokens` DB table; HS256 JWT session cookie with 30-day TTL; `getSession()` used on every protected route |
| AUTH-04 | App automatically refreshes expired tokens without user action | 01-02, 01-03 | SATISFIED | `getFreshAccessToken` in `tokens.ts`: checks expiry with 5-min buffer, calls `googleClient.refreshAccessToken`, updates DB; null return triggers `ReconnectBanner` as graceful fallback |

No orphaned requirements found. All 4 Phase 1 requirements are claimed by plans and have implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/dashboard/page.tsx` | 34 | "Sync features coming soon." | Info | Intentional Phase 2 placeholder; dashboard is spec'd as placeholder for this phase |
| `src/components/AccountDropdown.tsx` | 50 | `if (!meData) return null` | Info | Legitimate loading state guard, not a stub |

No blockers or warnings found. The "Sync features coming soon" text is explicitly part of the Plan 03 spec: "Render a simple placeholder dashboard... This is a placeholder — Phase 2 will replace it."

---

### Human Verification Required

All automated structural and wiring checks passed. The following items require live browser testing with real Google OAuth credentials and a configured Neon database.

#### 1. End-to-End Personal Google Sign-In

**Test:** Start the dev server (`npm run dev`) with all env vars set. Visit `http://localhost:3000`. Verify the wizard shows at Step 1 with a progress bar reading "Step 1 of 3" and a "Sign in with Google" button. Click the button.
**Expected:** Browser redirects to `accounts.google.com` OAuth consent screen listing calendar and profile permissions. After approving, browser returns to `http://localhost:3000` and wizard shows at Step 2.
**Why human:** Live Google OAuth redirect and PKCE code exchange cannot be automated without a browser and real credentials.

#### 2. School Google Account Linking

**Test:** From Step 2 of the wizard (after personal sign-in), click "Link School Account". After Google auth with a second account, verify the wizard advances to Step 3. Alternatively, click "Skip for now" and verify Step 3 appears directly.
**Expected:** Google prompts with `select_account` (account picker screen). After auth, wizard at Step 3. Skip button advances locally without a server round-trip.
**Why human:** Requires a second Google account, live session cookie, and school OAuth round-trip.

#### 3. Session Persistence Across Browser Restart

**Test:** Complete the full setup flow (all 3 steps). Close the browser window. Reopen the browser and navigate to `http://localhost:3000`.
**Expected:** Browser goes directly to `/dashboard` without showing the wizard again. The nav bar shows the account dropdown with the connected personal account email.
**Why human:** HttpOnly cookie persistence and 30-day TTL behavior requires actual browser restart.

#### 4. Silent Token Refresh (Transparent Background Refresh)

**Test:** Manually set an `oauth_tokens` DB row's `access_token_expires_at` to a past timestamp (with a valid `encrypted_refresh_token` stored). Navigate to any authenticated page that triggers `/api/auth/me`.
**Expected:** No ReconnectBanner appears. The token is refreshed silently in the background. The DB row shows a new `access_token_expires_at` in the future.
**Why human:** Requires DB manipulation, a valid refresh token, and observation of the Google OAuth refresh call response.

---

## Summary

Phase 1 goal — "Users can securely connect both Google accounts and stay connected across sessions" — is fully implemented in code. All 4 success criteria from ROADMAP.md are structurally verified:

- Personal Google OAuth: complete PKCE flow with user upsert and session cookie
- School Google linking: authenticated-only flow storing `role=school` tokens without creating new users
- Session persistence: AES-256-GCM encrypted tokens in Neon Postgres + HS256 JWT cookie (30 days)
- Automatic token refresh: `getFreshAccessToken` with 5-min expiry buffer and graceful `ReconnectBanner` fallback

All 26 artifacts are present and substantive (no stubs). All 16 key links are wired. All 4 requirements (AUTH-01 through AUTH-04) are satisfied. No blocker anti-patterns found.

The 4 human verification items are flow-level behaviors that require a live browser, real Google credentials, and a connected Neon database — they cannot be verified programmatically.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_

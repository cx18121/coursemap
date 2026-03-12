---
phase: 01-auth-foundation
plan: "01"
subsystem: auth
tags: [drizzle, neon, postgres, jwt, jose, aes-256-gcm, typescript, tdd]

# Dependency graph
requires: []
provides:
  - "Drizzle ORM schema with users and oauthTokens tables (email column, unique index on userId+role)"
  - "AES-256-GCM token encryption/decryption (encryptToken/decryptToken)"
  - "jose-based session JWT encrypt/decrypt and httpOnly cookie helpers"
  - "Neon HTTP Drizzle client (db export)"
  - "Drizzle Kit migration SQL ready to apply against Neon Postgres"
  - "jest.config.js with ts-jest (replaces next/jest SWC for WSL compatibility)"
affects:
  - 01-auth-foundation
  - 02-oauth-routes
  - 03-sync-features

# Tech tracking
tech-stack:
  added:
    - "arctic v3 (OAuth client — installed for later plans)"
    - "jose ^5 (session JWT signing/verification)"
    - "@neondatabase/serverless (Neon HTTP driver)"
    - "drizzle-orm ^0.40 (ORM + schema definition)"
    - "drizzle-kit ^0.30 (migration CLI)"
  patterns:
    - "AES-256-GCM with random 12-byte IV, base64(iv):base64(tag):base64(ciphertext) format"
    - "HS256 JWT session with 30-day TTL via jose SignJWT/jwtVerify"
    - "Drizzle pgTable with uniqueIndex for composite unique constraints"

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/index.ts
    - src/lib/tokens.ts
    - src/lib/session.ts
    - src/lib/__mocks__/next-headers.ts
    - src/lib/__tests__/tokens.test.ts
    - src/lib/__tests__/session.test.ts
    - src/lib/db/__tests__/schema.test.ts
    - drizzle.config.ts
    - .env.example
    - drizzle/0000_rapid_payback.sql
    - jest.config.js
    - next.config.js
  modified: []

key-decisions:
  - "Switched jest.config.js from next/jest (SWC) to ts-jest — next/jest SWC binaries hang in WSL environment on Windows NTFS filesystem"
  - "Added next/headers mock at src/lib/__mocks__/next-headers.ts — session.ts imports next/headers which requires Next.js runtime context not available in unit tests"
  - "jose ESM-only package requires transformIgnorePatterns exception in jest.config.js for ts-jest to process it"
  - "oauthTokens.email column added per plan — stores the Google email for each linked account for AccountDropdown display"

patterns-established:
  - "Token encryption: encryptToken('value') -> 'ivB64:tagB64:ciphertextB64' format — always encrypted before DB write"
  - "Session cookie: HS256 JWT carrying only userId, 30-day TTL, httpOnly+SameSite=lax"
  - "Drizzle unique constraint: pgTable third arg callback returns uniqueIndex object"

requirements-completed: [AUTH-01, AUTH-03]

# Metrics
duration: 28min
completed: 2026-03-12
---

# Phase 1 Plan 01: DB Schema, Token Encryption, and Session Management Summary

**AES-256-GCM token encryption and jose HS256 session JWTs on Neon Postgres schema with Drizzle ORM — foundation layer for all OAuth routes**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-12T16:18:17Z
- **Completed:** 2026-03-12T16:46:30Z
- **Tasks:** 2
- **Files modified:** 13 created, 1 modified

## Accomplishments

- Drizzle schema defining `users` and `oauthTokens` tables with all specified columns, including `email` on `oauthTokens` and a unique index on `(userId, role)`
- AES-256-GCM token encryption round-trips correctly in tests (14 tests, all pass)
- jose HS256 session JWT encrypt/decrypt works correctly; garbage input returns null without throwing
- Drizzle migration SQL generated and verified to contain CREATE TABLE for both tables with all columns and constraints
- Jest test framework configured with ts-jest (bypassing SWC) for WSL compatibility

## Task Commits

Each task was committed atomically:

1. **TDD RED - Failing tests** - `6707506` (test)
2. **TDD GREEN - Implementations** - `e64a72d` (feat)
3. **Task 2: Generate Drizzle migration** - `1a886b7` (chore)

## Files Created/Modified

- `src/lib/db/schema.ts` - Drizzle pgTable definitions for users and oauthTokens
- `src/lib/db/index.ts` - Drizzle client via Neon HTTP driver, exports `db`
- `src/lib/tokens.ts` - AES-256-GCM encryptToken/decryptToken using TOKEN_ENCRYPTION_KEY env var
- `src/lib/session.ts` - jose HS256 JWT encryptSession/decryptSession + setSessionCookie/getSession/clearSessionCookie
- `src/lib/__mocks__/next-headers.ts` - In-memory mock for next/headers in unit tests
- `src/lib/__tests__/tokens.test.ts` - Tests: round-trip, format, tamper detection, random IV
- `src/lib/__tests__/session.test.ts` - Tests: round-trip userId, null on garbage/empty/malformed, exp field check
- `src/lib/db/__tests__/schema.test.ts` - Structural tests for table exports and column presence
- `drizzle.config.ts` - Drizzle Kit config pointing to schema.ts, outputs to ./drizzle
- `.env.example` - All required env vars with generation commands
- `drizzle/0000_rapid_payback.sql` - CREATE TABLE migration with FK and unique index
- `jest.config.js` - ts-jest config with jose in transformIgnorePatterns
- `next.config.js` - Plain JS next config (avoids SWC TypeScript parse hanging in WSL)

## Decisions Made

- **ts-jest over next/jest:** next/jest loads SWC Rust binaries that hang indefinitely in WSL on Windows NTFS filesystem. Replaced with ts-jest which compiles TypeScript directly via tsc. The tradeoff is slightly different module resolution, but all lib unit tests work correctly.
- **next/headers mock:** `session.ts` imports `next/headers` for the cookie helpers (setSessionCookie, getSession, clearSessionCookie). These functions can't be unit tested directly without a Next.js request context. Created an in-memory mock so the module can be imported in tests. The `encryptSession`/`decryptSession` functions which are the ones actually tested don't use next/headers at all.
- **jose ESM handling:** jose v5 ships as ESM-only (no CommonJS build). Added `jose` to `transformIgnorePatterns` exception list so ts-jest transpiles it during testing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] next/jest SWC hangs in WSL — switched to ts-jest**
- **Found during:** Task 1 (initial test run attempt)
- **Issue:** `next/jest` loads Next.js SWC Rust compiler binaries. The Windows NTFS binaries cannot execute in WSL (hang indefinitely — no error, no output)
- **Fix:** Replaced jest.config.js with ts-jest config. Added `next.config.js` (plain CommonJS) alongside `next.config.ts` so Next.js still works at runtime. Added `jest-environment-node` instead of jsdom (lib tests don't need DOM)
- **Files modified:** jest.config.js, next.config.js (new)
- **Verification:** Jest completes in ~55-70s (slow due to Windows NTFS I/O but functional); 14 tests pass
- **Committed in:** 6707506 (TDD RED commit)

**2. [Rule 2 - Missing Critical] Added next/headers mock for session unit tests**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** session.ts imports `next/headers` at module level. Without a mock, dynamic import fails in jest context with "cannot find module" or runtime error
- **Fix:** Created `src/lib/__mocks__/next-headers.ts` with in-memory cookie store, mapped in jest.config.js via moduleNameMapper
- **Files modified:** src/lib/__mocks__/next-headers.ts (new), jest.config.js
- **Verification:** Session tests pass; encryptSession/decryptSession work correctly
- **Committed in:** e64a72d (TDD GREEN commit)

**3. [Rule 2 - Missing Critical] Added jose to transformIgnorePatterns**
- **Found during:** Task 1 (GREEN phase — jose SyntaxError on ESM export)
- **Issue:** jose v5 is ESM-only; ts-jest's default transformIgnorePatterns excludes all node_modules, causing "Unexpected token 'export'" when jose is imported
- **Fix:** Added `jose` to transformIgnorePatterns exception: `/node_modules/(?!(jose|@panva|oidc-token-hash)/)`
- **Files modified:** jest.config.js
- **Verification:** Session tests pass after fix
- **Committed in:** e64a72d (TDD GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** All auto-fixes required for the test infrastructure to function in WSL. Zero scope creep — implementations exactly match plan spec. Production Next.js runtime unaffected by jest config changes.

## Issues Encountered

- WSL performance: Jest takes ~55-70 seconds per run due to loading node_modules from Windows NTFS via WSL. This is expected in the environment and does not affect correctness. Tests on Windows (native) run in ~2 seconds per the existing jest_output.txt.

## User Setup Required

**External services require manual configuration before applying migrations:**

1. Create a Neon project at https://console.neon.tech
2. Copy the connection string (Project → Connection Details → Connection string)
3. Add to `.env.local`: `DATABASE_URL=<connection-string>`
4. Run migrations: `npx drizzle-kit migrate`
5. Generate TOKEN_ENCRYPTION_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
6. Generate SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Next Phase Readiness

- All lib modules (db, tokens, session) are tested and ready to import
- OAuth route handlers (next plans in phase 01) can import from `@/lib/db`, `@/lib/tokens`, `@/lib/session`
- Migration SQL is ready to apply when DATABASE_URL is configured
- Note: jest runs slowly in WSL (~60s/run) — consider running tests on Windows side for iterative development

## Self-Check: PASSED

All files confirmed present. All task commits confirmed in git log:
- `6707506` test(01-01): TDD RED tests
- `e64a72d` feat(01-01): GREEN implementations
- `1a886b7` chore(01-01): Drizzle migration
- `1a2f6e2` docs(01-01): SUMMARY + STATE + ROADMAP metadata

---
*Phase: 01-auth-foundation*
*Completed: 2026-03-12*

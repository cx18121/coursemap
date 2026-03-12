# Codebase Concerns

**Analysis Date:** 2026-03-11

## Type Safety Issues

**Untyped Error Handling:**
- Issue: Multiple catch blocks use `any` type for error parameters, defeating TypeScript type safety
- Files:
  - `src/app/api/parse-ics/route.ts:24` (line 24)
  - `src/app/api/sync-gcal/route.ts:32` (line 32)
  - `src/components/CalendarSetup.tsx:31, 63` (lines 31 and 63)
- Impact: Code loses type information in error handlers, making it impossible to safely access error properties; breaks strict TypeScript checking
- Fix approach: Replace `error: unknown` with proper error union types or use type guards instead of `instanceof` checks

**Unused Variables:**
- Issue: Imported but unused variable; exception handler parameter ignored
- Files:
  - `src/services/icalParser.test.ts:1` - unused `CanvasEvent` import
  - `src/services/icalParser.ts:21` - unused catch parameter `e`
- Impact: Code smell; ESLint errors indicate incomplete refactoring
- Fix approach: Remove unused imports and properly handle caught errors (currently swallowed)

## Security Concerns

**Unencrypted Token Handling:**
- Risk: Access tokens transmitted in plain text in request body
- Files:
  - `src/components/CalendarSetup.tsx:52` (sends accessToken in JSON body)
  - `src/app/api/sync-gcal/route.ts:6` (receives accessToken from client)
- Current mitigation: None visible - tokens are client-provided and forwarded
- Symptoms: User must manually paste sensitive access tokens into UI; tokens flow unencrypted through HTTP request bodies
- Recommendations:
  - Implement server-side OAuth2 flow (authorization code grant) instead of token pasting
  - Use secure, httpOnly cookies to store tokens server-side
  - Implement token refresh mechanism with short expiration times
  - Add HTTPS enforcement in production

**Lack of CSRF Protection:**
- Risk: POST endpoints (`/api/parse-ics`, `/api/sync-gcal`) lack CSRF tokens
- Files: `src/app/api/parse-ics/route.ts`, `src/app/api/sync-gcal/route.ts`
- Current mitigation: None
- Recommendations: Add CSRF token validation or use SameSite cookie attributes

**No Input Validation on URLs:**
- Risk: While `isValidUrl` exists, it only checks URL format, not domain whitelist
- Files: `src/services/icalParser.ts:17-24`
- Current mitigation: Basic URL structure validation only
- Recommendations: Whitelist Canvas domains or validate against user's institution

## Testing Coverage Gaps

**Incomplete Test Suite:**
- What's not tested:
  - `src/components/CalendarSetup.tsx` - component logic, state management, and error display
  - `src/services/gcalSync.ts` - Google Calendar API interaction (mocked in plan but not implemented)
  - `src/app/api/parse-ics/route.ts` - API route error handling and edge cases
  - `src/app/api/sync-gcal/route.ts` - API route validation and sync logic
- Files: Entire component and API route layer
- Risk: Critical user-facing code has zero test coverage; sync failures may go undetected
- Priority: High - core functionality untested

**Missing Test Script:**
- Issue: `package.json` missing `test` script; Jest configured but unreachable
- Current: `npm test` fails with "Missing script: test"
- Impact: Testing infrastructure installed but disconnected; developers cannot run tests
- Fix approach: Add `"test": "jest"` to package.json scripts

## Performance Bottlenecks

**Inefficient Sliding Window Concurrency:**
- Problem: Overly simplistic queue processing with hardcoded CONCURRENCY = 3
- Files: `src/services/gcalSync.ts:89-107`
- Cause: Queue implementation spawns all workers at once but doesn't actually limit concurrency properly; workers share a mutable queue array (potential race conditions)
- Current: All events queued upfront, all workers started immediately regardless of load
- Improvement path:
  - Replace with promise pool pattern or use library like `p-queue`
  - Implement exponential backoff for rate limit recovery
  - Add configurable concurrency based on quota limits

**No Batch Processing:**
- Issue: Events synced one-by-one with individual API calls
- Files: `src/services/gcalSync.ts:38-87`
- Current: Each event requires separate `calendar.events.list()` + `update/insert` call
- Impact: Scales poorly with large course loads; hits rate limits quickly
- Improvement: Use Google Calendar batch API for bulk operations

**Unoptimized Course Grouping:**
- Issue: Uses regex parsing to extract course name from event summary
- Files: `src/services/icalParser.ts:30-32`
- Problem: Fragile parsing - depends on exact Canvas ICS format (`[CourseeName]` suffix)
- Mitigation: No fallback if format changes; "Unknown Course" catchall hides problems
- Fix: Parse from event properties (VEVENT:LOCATION, VEVENT:ORGANIZER) if available

## Fragile Areas

**Canvas ICS Format Dependency:**
- Files: `src/services/icalParser.ts:30-32`
- Why fragile: Course names extracted via regex `/\[(.*?)\]$/` which assumes summary ends with `[CourseName]`
- Safe modification:
  - Add unit tests for various Canvas ICS formats
  - Log extracted vs. fallback course names for debugging
  - Document expected Canvas version compatibility
- Test coverage: Regex extraction only tested with 2 mock events in `icalParser.test.ts`

**Event Deduplication Logic:**
- Files: `src/services/gcalSync.ts:61-66`
- Why fragile: Relies on private extended properties to find existing events
  - Query uses `privateExtendedProperty` filter which may not work reliably
  - No handling for partial matches or corrupted metadata
- Safe modification:
  - Add fallback: search by title + date range if extended property fails
  - Implement idempotency token in event creation
  - Log deduplication decisions

**Manual Token Input Flow:**
- Files: `src/components/CalendarSetup.tsx:77-82`
- Why fragile:
  - Users paste raw access tokens into text input (no masking/visibility toggle)
  - No token validation before submission
  - Accidental token copy-paste to logs/screenshots
- Safe modification:
  - Implement proper OAuth2 flow with authorization endpoint
  - Add token validation before API submission
  - Implement password-type input with copy-to-clipboard button

## Known Build Issues

**Node-ical BigInt Runtime Error:**
- Symptoms: Build succeeds, but page data collection fails with `s.BigInt is not a function`
- Files: Indirect - triggered during Turbopack page collection
- Trigger: Running `npm run build` collects page data for `/api/parse-ics`
- Current state: Build fails at "Collecting page data using 7 workers" stage
- Root cause: node-ical dependency uses BigInt which isn't available in current Node.js context during build
- Workaround: None visible in current setup
- Fix approach:
  - Upgrade node-ical to version that doesn't require BigInt at build time
  - Move ICS parsing to request-time only (not build-time static generation)
  - Add `--experimental-global-bigint` flag to Node.js runtime if possible

**ESLint Errors Block Deployment:**
- Symptoms: `npm run lint` reports 4 errors (any-type violations) and 2 warnings
- Files: Parse-ics route, sync-gcal route, CalendarSetup component, icalParser service
- Impact: CI/CD pipelines typically fail on ESLint errors; cannot merge/deploy
- Current state: Not blocking locally, but best practices enforcement missing

## Incomplete Features

**Missing OAuth2 Implementation:**
- Problem: Google authentication requires manual token pasting instead of proper OAuth flow
- Blocks: Production deployment; enterprise/institutional use; security hardening
- Current: `CalendarSetup.tsx:73-83` shows placeholder comment "Fake OAuth Input for Prototype"
- Impact: Users must manually generate and paste sensitive access tokens

**No Color Customization UI:**
- Problem: `courseColorMap` always sent as empty object `{}`
- Files: `src/components/CalendarSetup.tsx:55`
- Current: Comment states "can be expanded to UI inputs later"
- Impact: Events cannot be organized by color; reduces usability

**Missing Error Recovery:**
- Problem: Sync failures show summary but not recovery options
- Files: `src/app/api/sync-gcal/route.ts:24-29`
- Current: Response includes failed count, but client only shows alert
- Impact: Users don't know which events failed or why; manual intervention required

## Environment & Configuration

**No Environment Variable Support:**
- Issue: No `.env` handling for Canvas domains, rate limits, or deployment config
- Current: Hardcoded CONCURRENCY = 3
- Impact: Configuration requires code changes for different environments
- Fix: Add `.env.example` with configurable limits and domain whitelists

**Missing Deployment Configuration:**
- No vercel.json, .env.example, or docker setup visible
- Impact: Unclear how to deploy beyond Next.js defaults

---

*Concerns audit: 2026-03-11*

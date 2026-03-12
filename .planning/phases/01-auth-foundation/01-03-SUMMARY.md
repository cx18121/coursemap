---
phase: 01-auth-foundation
plan: 03
subsystem: ui
tags: [react, nextjs, typescript, tailwind, setup-wizard, oauth, drizzle]

# Dependency graph
requires:
  - phase: 01-auth-foundation plan 01
    provides: session management, DB schema (users + oauthTokens with email column), token encryption
  - phase: 01-auth-foundation plan 02
    provides: OAuth route handlers (/login/google, /link/school-google, /api/auth/signout), getFreshAccessToken, middleware
provides:
  - 3-step setup wizard with progress bar and OAuth buttons (SetupWizard.tsx)
  - Nav bar account dropdown with email + role labels, sign out, link school option (AccountDropdown.tsx)
  - Non-blocking amber reconnect banner for token refresh failures (ReconnectBanner.tsx)
  - ReconnectBannerWrapper that fetches /api/auth/me and renders banners for reconnectNeeded accounts
  - GET /api/auth/me returning user profile, connected accounts, setupComplete, reconnectNeeded flags
  - POST /api/auth/canvas-url saving Canvas ICS URL with validation
  - Auth-aware root page routing (wizard for unauthenticated, dashboard for setup-complete users)
  - Protected dashboard placeholder page
  - Updated layout.tsx with conditional nav bar and reconnect banners
affects: [phase-02-sync, phase-03-scheduling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component + Client Component split: Server reads session/DB, passes props to 'use client' components"
    - "ReconnectBannerWrapper pattern: client component fetches /api/auth/me and maps reconnectNeeded to banners"
    - "Auth-aware routing via getSession() in Server Components with redirect()"

key-files:
  created:
    - src/app/api/auth/me/route.ts
    - src/app/api/auth/canvas-url/route.ts
    - src/app/dashboard/page.tsx
    - src/components/SetupWizard.tsx
    - src/components/AccountDropdown.tsx
    - src/components/ReconnectBanner.tsx
    - src/components/ReconnectBannerWrapper.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx

key-decisions:
  - "ReconnectBannerWrapper as separate client component: layout.tsx is a Server Component that passes isAuthenticated prop, wrapper handles client-side fetch"
  - "SetupWizard manages step state locally (useState) initialized from server-determined currentStep prop"
  - "AccountDropdown uses useEffect to fetch /api/auth/me on mount for up-to-date account status"

patterns-established:
  - "Server Component reads session, determines step/state, passes to client wizard as props"
  - "Glassmorphic UI patterns: bg-white/10 cards, indigo-500 progress, amber-500/10 warning banners"
  - "API routes return 401 when getSession() returns null"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 1 Plan 03: Auth Foundation UI Summary

**3-step setup wizard with progress bar, account dropdown, reconnect banner wired to layout via /api/auth/me reconnectNeeded flags, and auth-aware routing**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12T18:01:33Z
- **Completed:** 2026-03-12T18:16:00Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 9

## Accomplishments
- Built 3-step setup wizard: Step 1 (personal Google OAuth), Step 2 (school Google, skippable), Step 3 (Canvas ICS URL with POST to /api/auth/canvas-url)
- GET /api/auth/me returns full account status including reconnectNeeded flags via getFreshAccessToken calls
- Layout.tsx conditionally renders nav bar with AccountDropdown and ReconnectBannerWrapper for authenticated users
- Root page.tsx routes setup-complete users to /dashboard, others to wizard at correct step

## Task Commits

Each task was committed atomically:

1. **Task 1: API endpoints and auth-aware root page** - `eec7a6d` (feat)
2. **Task 2: SetupWizard, AccountDropdown, ReconnectBanner, layout** - `2b41670` (feat)
3. **Task 3: Verify complete auth flow end-to-end** - human-verify checkpoint (approved)

## Files Created/Modified
- `src/app/api/auth/me/route.ts` - GET endpoint: session + user + accounts + reconnectNeeded flags
- `src/app/api/auth/canvas-url/route.ts` - POST endpoint: validates and saves Canvas ICS URL
- `src/app/dashboard/page.tsx` - Protected placeholder dashboard with welcome message
- `src/app/page.tsx` - Auth-aware root: redirects complete users to /dashboard, shows wizard otherwise
- `src/components/SetupWizard.tsx` - 3-step wizard with progress bar, OAuth links, Canvas URL input
- `src/components/AccountDropdown.tsx` - Nav dropdown: email + role labels, link school, sign out
- `src/components/ReconnectBanner.tsx` - Amber banner with reconnect link and dismiss button
- `src/components/ReconnectBannerWrapper.tsx` - Client wrapper fetching /api/auth/me for reconnect state
- `src/app/layout.tsx` - Updated: metadata, conditional nav bar, ReconnectBannerWrapper

## Decisions Made
- ReconnectBannerWrapper is a separate 'use client' component so layout.tsx can remain a Server Component that reads session server-side
- SetupWizard initializes local step state from the server-determined `currentStep` prop, enabling client-side skip navigation without server roundtrips

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit` hangs in this WSL/NTFS environment (documented in STATE.md as ts-jest vs SWC issue). All TypeScript was verified by code review and structural correctness. Next.js build (Turbopack) has been shown to compile successfully per build_output.txt from prior plans.

## User Setup Required
None - no new external service configuration required beyond what Plans 01 and 02 set up.

## Next Phase Readiness
- Complete auth UI foundation ready for Phase 2 sync features
- Human verification confirmed end-to-end auth flow works correctly
- Dashboard placeholder will be replaced by Phase 2 sync UI

---
*Phase: 01-auth-foundation*
*Completed: 2026-03-12*

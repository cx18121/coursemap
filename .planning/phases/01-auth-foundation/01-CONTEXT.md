# Phase 1: Auth Foundation - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent dual-account Google OAuth with encrypted token storage. Users can securely connect both a personal and school Google account and stay connected across sessions. No sync functionality in this phase — just auth, session, and account management.

</domain>

<decisions>
## Implementation Decisions

### Sign-in flow
- Step-by-step wizard: Step 1 = connect personal Google, Step 2 = link school Google, Step 3 = paste Canvas ICS URL
- School account linking is optional — user can skip and add it later
- Wizard appears on every visit until at least personal account is connected and Canvas URL is saved
- Progress bar shows current step (1 of 3, 2 of 3, 3 of 3)

### Account management
- Account info lives in a header/nav bar dropdown — always accessible
- Dropdown shows email + role label ("Personal" / "School") for each connected account
- If school account not linked, dropdown includes a "Link school account" option
- Single "Sign out" action clears everything (no per-account disconnect)

### Session & return visits
- Returning users with valid session go straight to dashboard — no splash screen
- Multi-user support from the start — each Google sign-in creates a separate user record, DB stores tokens per user
- Sign-out clears session cookie and DB tokens, redirects to setup wizard

### Auth failure handling
- School OAuth blocked by institution: clear message explaining restriction + "Try again" and "Skip for now" buttons
- Token refresh failure: non-blocking banner at top with "Reconnect" button — don't auto sign out
- Partial failure (school token fails, personal fine): degrade gracefully — Canvas ICS sync keeps working, only school calendar mirroring disabled, subtle indicator that school needs reconnection
- Error messages: simple and actionable, 3 categories max: "connection expired" (reconnect), "access denied" (try again/skip), "something went wrong" (retry). No technical details shown to user

### Claude's Discretion
- Session TTL duration (Claude to pick appropriate value)
- Exact progress bar / wizard styling
- Session cookie implementation details
- DB schema design for user and token tables
- Token encryption approach

</decisions>

<specifics>
## Specific Ideas

- Wizard should feel like the existing CalendarSetup numbered-step pattern (Step 1, Step 2, Step 3) but with real OAuth buttons instead of token paste
- School blocked message should explain that Canvas ICS sync still works without school account — not a dead end

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CalendarSetup.tsx`: Existing numbered-step UI pattern (Step 1, 2, 3) with glassmorphic card styling — wizard can follow this visual pattern
- `gcalSync.ts`: Creates `google.auth.OAuth2()` client from raw access token — will need refactoring to pull tokens from DB instead
- Tailwind CSS v4 + glassmorphic cards (white/10 bg, backdrop-blur, rounded-2xl) — established visual language

### Established Patterns
- Client-side state via React `useState` hooks — no global state management
- API routes at `src/app/api/` handle server logic
- Service layer at `src/services/` abstracts external integrations
- Error display: red error box in component (`bg-red-500/20 border border-red-500/50`)

### Integration Points
- `src/app/page.tsx`: Root page that mounts CalendarSetup — will need auth-aware routing (wizard vs dashboard)
- `src/app/layout.tsx`: Root layout — nav bar with account dropdown would be added here or in a new layout component
- API routes will need auth middleware to validate session and retrieve tokens
- `gcalSync.ts` SyncOptions interface currently takes raw `accessToken` — will need to accept tokens from session/DB

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-auth-foundation*
*Context gathered: 2026-03-12*

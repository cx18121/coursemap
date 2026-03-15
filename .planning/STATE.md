---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 04-event-type-grouping 04-04-PLAN.md — per-type sync filters design revision complete
last_updated: "2026-03-15T23:15:46.820Z"
last_activity: 2026-03-11 — Roadmap created, ready to plan Phase 1
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 13
  completed_plans: 12
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Completed 03-reliability-and-deploy 03-02-PLAN.md — v1 milestone complete, app live at https://canvas-to-gcal.vercel.app"
last_updated: "2026-03-15T19:41:14.519Z"
last_activity: 2026-03-11 — Roadmap created, ready to plan Phase 1
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** All of a student's deadlines and events — from Canvas, school Google, and personal Google — visible in one calendar on one account.
**Current focus:** Phase 1 — Auth Foundation

## Current Position

Phase: 1 of 3 (Auth Foundation)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created, ready to plan Phase 1

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-auth-foundation P01 | 29 | 2 tasks | 13 files |
| Phase 01-auth-foundation P02 | 22 | 2 tasks | 10 files |
| Phase 01-auth-foundation P03 | 7 | 2 tasks | 9 files |
| Phase 01-auth-foundation P03 | 15 | 3 tasks | 9 files |
| Phase 02-sync-pipeline P01 | 691 | 2 tasks | 9 files |
| Phase 02-sync-pipeline P02 | 45 | 2 tasks | 5 files |
| Phase 02-sync-pipeline P03 | 8 | 2 tasks | 5 files |
| Phase 02-sync-pipeline P04 | 34 | 2 tasks | 10 files |
| Phase 03-reliability-and-deploy P01 | 46 | 3 tasks | 5 files |
| Phase 03-reliability-and-deploy P02 | 14 | 1 tasks | 1 files |
| Phase 03-reliability-and-deploy P02 | 40 | 2 tasks | 1 files |
| Phase 04-event-type-grouping-sub-calendars-per-course-and-type P01 | 15 | 2 tasks | 5 files |
| Phase 04-event-type-grouping P02 | 10 | 2 tasks | 4 files |
| Phase 04-event-type-grouping-sub-calendars-per-course-and-type P04 | 11 | 2 tasks | 6 files |
| Phase 04-event-type-grouping-sub-calendars-per-course-and-type P04 | 25 | 3 tasks | 8 files |

## Accumulated Context

### Decisions

- [Init]: Use `arctic` + `jose` for OAuth (not NextAuth) — dual-account requirement breaks NextAuth's session model
- [Init]: Neon Postgres + Drizzle ORM for token storage — cookies overflow at 4 KB with two accounts
- [Init]: Personal Google account is the sync target — school account is read-only source
- [Init]: Mirror is one-way only (school → personal) — avoids write-permission issues with school IT
- [Phase 01-auth-foundation]: ts-jest over next/jest: SWC Rust binaries hang in WSL on Windows NTFS; ts-jest provides compatible TypeScript compilation for lib unit tests
- [Phase 01-auth-foundation]: next/headers mock at src/lib/__mocks__/next-headers.ts: allows session.ts to be imported in unit tests without Next.js runtime
- [Phase 01-auth-foundation]: jose transformIgnorePatterns exception: jose v5 is ESM-only, requires ts-jest to transform it for CommonJS test environment
- [Phase 01-auth-foundation]: Two Arctic Google client instances required: personal (/login/google/callback) and school (/link/school-google/callback) use different redirect_uri, which is bound at construction time
- [Phase 01-auth-foundation]: getFreshAccessToken uses 5-minute expiry buffer before refresh to avoid using near-expired tokens mid-request
- [Phase 01-auth-foundation]: Middleware excludes /api from matcher — CVE-2025-29927 guidance: API routes verify session server-side, middleware is optimistic only
- [Phase Phase 01-auth-foundation]: ReconnectBannerWrapper as separate client component: layout.tsx Server Component passes isAuthenticated, wrapper handles client-side fetch
- [Phase Phase 01-auth-foundation]: SetupWizard manages step state locally (useState) initialized from server-determined currentStep prop — enables skip navigation without server roundtrips
- [Phase 02-sync-pipeline]: Default-include pattern for course/event selections: no DB row means enabled, only exceptions stored
- [Phase 02-sync-pipeline]: eventTitleCache uses onConflictDoNothing to handle concurrent cache writes without errors
- [Phase 02-sync-pipeline]: colorAssignment round-robins through 11 Google Calendar event colorIds; existing courses keep their assigned color
- [Phase 02-sync-pipeline]: Bulk dedup replaces CONCURRENCY=3: single events.list per sub-calendar reduces N API calls to 1 per course for Canvas sync
- [Phase 02-sync-pipeline]: ensureSubCalendar DB-first pattern prevents sub-calendar duplication — calendarId stored in courseSelections.gcalCalendarId after creation
- [Phase 02-sync-pipeline]: colorId set at sub-calendar level only, not per-event — allows Google Calendar UI per-event color overrides and avoids calendar vs event palette confusion
- [Phase 02-sync-pipeline]: School event titles copied verbatim to mirror calendars — no AI cleanup on school events per locked decision in CONTEXT.md
- [Phase 02-sync-pipeline]: parse-ics switched to GET with session auth: no raw URLs in request bodies, canvasIcsUrl fetched from DB
- [Phase 02-sync-pipeline]: Fire-and-forget void promise for background sync: simpler than waitUntil, sufficient for manual sync button use case
- [Phase 02-sync-pipeline]: In-memory syncJobs Map with 5-minute TTL: acceptable for manual sync, progress loss on restart is acceptable
- [Phase 02-sync-pipeline]: Server Component detects school account via oauthTokens query — boolean prop avoids client-side token exposure
- [Phase 02-sync-pipeline]: calendarList.patch used for colorId on sub-calendars — colorId is a calendarList property, not a Calendar property
- [Phase 02-sync-pipeline]: SyncSummary cleared on any change (course/event/color) per CONTEXT.md locked decision — no auto-dismiss
- [Phase 02-sync-pipeline]: createPortal used for ColorPicker: backdrop-blur-lg creates inescapable stacking context; portal renders at document.body with position:fixed at z-index 9999
- [Phase 03-reliability-and-deploy]: classifyError function maps auth/quota/canvas/unknown errors to actionable user-facing strings in sync route catch block
- [Phase 03-reliability-and-deploy]: after() from next/server replaces void fire-and-forget for Vercel background task lifecycle safety
- [Phase 03-reliability-and-deploy]: Node env for component tests: jsdom 26 hangs on Node 22/WSL, tests use pure-function approach instead
- [Phase 03-reliability-and-deploy]: vercel.json minimal config with framework: nextjs only — sufficient for Next.js App Router; no custom routes needed
- [Phase 03-reliability-and-deploy]: Deployment via Vercel Git integration — push to main triggers auto-deploy
- [Phase 04-event-type-grouping]: Drizzle migration applied directly via neon serverless driver (not drizzle-kit migrate) because __drizzle_migrations table was absent; only new ADD COLUMN and CREATE TABLE statements applied
- [Phase 04-event-type-grouping]: Quiz pluralization: 'quiz' ends in 'z' so appends 'zes' not 's', yielding 'Quizzes' for type sub-calendar naming
- [Phase 04-event-type-grouping]: icalParser mock fix: ical.async.fromURL pattern corrected — __esModule:true means default import resolves directly
- [Phase 04-event-type-grouping]: syncCanvasEvents typeGroupingEnabled is optional (defaults to false) to preserve backward compatibility with existing callers
- [Phase 04-event-type-grouping]: Toggle PATCH uses optimistic update with silent revert on failure — matches existing course toggle UX pattern
- [Phase 04-event-type-grouping]: typeGroupingEnabled read from users DB row in POST /api/sync handler and passed as parameter to runSyncJob — avoids extra DB call inside background job
- [Phase 04-event-type-grouping]: Type grouping always-on: replaced typeGroupingEnabled boolean with 4 per-type columns (sync_assignments/quizzes/discussions/events), all default true; no master toggle
- [Phase 04-event-type-grouping]: Announcements grouped under syncEvents toggle in UI and TYPE_TOGGLE_MAP — no separate announcement checkbox

### Roadmap Evolution

- Phase 4 added: Event type grouping — sub-calendars per course and type

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: OAuth app must be published to Production status (not left in Testing mode) before deploying — Testing mode causes 7-day refresh token expiry
- [Phase 1]: Some school institutions restrict third-party OAuth on Google Workspace accounts — onboarding must handle this with a clear fallback message
- [Phase 2]: Existing `CONCURRENCY = 3` pattern in `gcalSync.ts` will time out on realistic datasets — must be replaced with batch API calls before enabling scheduled sync

## Session Continuity

Last session: 2026-03-15T23:15:46.787Z
Stopped at: Completed 04-event-type-grouping 04-04-PLAN.md — per-type sync filters design revision complete
Resume file: None

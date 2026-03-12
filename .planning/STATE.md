---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01-auth-foundation 01-02-PLAN.md
last_updated: "2026-03-12T17:59:57.645Z"
last_activity: 2026-03-11 — Roadmap created, ready to plan Phase 1
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: OAuth app must be published to Production status (not left in Testing mode) before deploying — Testing mode causes 7-day refresh token expiry
- [Phase 1]: Some school institutions restrict third-party OAuth on Google Workspace accounts — onboarding must handle this with a clear fallback message
- [Phase 2]: Existing `CONCURRENCY = 3` pattern in `gcalSync.ts` will time out on realistic datasets — must be replaced with batch API calls before enabling scheduled sync

## Session Continuity

Last session: 2026-03-12T17:59:57.590Z
Stopped at: Completed 01-auth-foundation 01-02-PLAN.md
Resume file: None

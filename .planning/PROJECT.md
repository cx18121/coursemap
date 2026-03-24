# Canvas-to-GCal

## What This Is

A deployed web app that automatically syncs Canvas LMS assignments and school Google Calendar events into a student's personal Google Calendar. Users connect two Google accounts (school + personal), paste their Canvas ICS feed URL, choose which courses and event types to include, and the app syncs events into organized per-course sub-calendars. Live at https://coursemap.vercel.app.

## Core Value

All of a student's deadlines and events — from Canvas, school Google, and personal Google — visible in one calendar on one account.

## Current Milestone: v1.1 — Automation & Visibility

**Goal:** Make sync automatic and give users visibility into what's happening and what's coming up.

**Target features:**
- Auto-sync via Vercel cron (daily, runs for all users)
- Canvas deadline countdown on the dashboard
- Event deduplication dashboard (what's already synced vs. what would be added)
- Sync conflict resolution UI (surface differing events for user decision)

## Requirements

### Validated

- ✓ Canvas ICS feed parsing and course grouping — Phase 1 (`icalParser.ts`)
- ✓ Google Calendar event creation/update with dedup — Phase 1 (`gcalSync.ts`)
- ✓ Basic UI with feed URL input and course display — Phase 1 (`CalendarSetup.tsx`)
- ✓ Dual Google OAuth (school + personal accounts) — Phase 1
- ✓ Course-level and event-level filtering UI — Phase 2
- ✓ Canvas events pushed to personal Google Calendar sub-calendars — Phase 2
- ✓ School Google Calendar mirrored to personal account — Phase 2
- ✓ Manual sync trigger with status feedback — Phase 3
- ✓ Deployed to Vercel with production OAuth — Phase 3
- ✓ Per-course, per-type sub-calendar grouping with AI event classification — Phase 4

### Active

- [ ] Auto-sync via Vercel cron (daily, all users)
- [ ] Canvas deadline countdown on dashboard
- [ ] Event deduplication dashboard
- [ ] Sync conflict resolution UI

### Out of Scope

- Two-way sync between accounts — one-direction mirror only (school → personal)
- Mobile native app — web-only
- Non-Google calendar targets — Google Calendar only
- Canvas API integration — ICS feed only (no Canvas OAuth)
- Push notifications / email summaries — deferred to future milestone

## Context

- Next.js 16 / React 19 / TypeScript, deployed on Vercel (Hobby plan — cron limited to once/day)
- Neon Postgres + Drizzle ORM for token storage and user preferences
- `arctic` + `jose` for OAuth (not NextAuth — dual-account requirement)
- Per-user settings: course selections, event type toggles, school calendar selections
- AI event classifier (`eventTypeClassifier`) assigns Assignments/Quizzes/Discussions/Events types
- `after()` from `next/server` used for background sync tasks (Vercel lifecycle safe)
- 141 tests passing; ts-jest used (SWC hangs in WSL)

## Constraints

- **Tech stack**: Next.js App Router — build on it
- **Cron**: Vercel Hobby plan limits cron to once/day minimum interval
- **Canvas integration**: ICS feed only (no Canvas API/OAuth needed)
- **Deployment**: Vercel Git integration — push to main triggers auto-deploy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Personal account is the combined sync target | User wants everything in one place on their personal calendar | ✓ Good |
| Mirror school → personal (one-way) | Simpler than bidirectional, avoids write-permission issues with school IT | ✓ Good |
| `arctic` + `jose` over NextAuth | Dual-account requirement breaks NextAuth's session model | ✓ Good |
| Neon Postgres + Drizzle for storage | Cookies overflow at 4 KB with two OAuth tokens | ✓ Good |
| Type grouping always-on (4 per-type flags, no master toggle) | Cleaner UX; per-type filters replace global boolean | ✓ Good |
| Daily auto-sync (Vercel cron) | Vercel Hobby plan limit; sufficient for daily deadline tracking | — Pending |

---
*Last updated: 2026-03-16 after v1.0 milestone complete, v1.1 started*

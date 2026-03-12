# Canvas-to-GCal

## What This Is

A web app that syncs Canvas LMS assignments and school Google Calendar events into a single personal Google Calendar. Users paste their Canvas ICS feed URL, pick which courses and events to keep, and push them to Google Calendar. It also mirrors events from a school Google account to the personal one, creating one combined schedule.

## Core Value

All of a student's deadlines and events — from Canvas, school Google, and personal Google — visible in one calendar on one account.

## Requirements

### Validated

- ✓ Canvas ICS feed parsing and course grouping — existing (`icalParser.ts`)
- ✓ Google Calendar event creation/update with dedup — existing (`gcalSync.ts`)
- ✓ Basic UI with feed URL input and course display — existing (`CalendarSetup.tsx`)

### Active

- [ ] Proper Google OAuth flow for two accounts (school + personal)
- [ ] Course-level and event-level filtering UI
- [ ] Push selected Canvas events to personal Google Calendar
- [ ] Mirror school Google Calendar events to personal Google Calendar
- [ ] Automatic scheduled sync (plus manual trigger)
- [ ] Deployed as a web app (Vercel or similar)

### Out of Scope

- Two-way sync between accounts — one-direction mirror only (school → personal)
- Mobile native app — web-only
- Non-Google calendar targets — Google Calendar only
- Canvas API integration — ICS feed only (no Canvas OAuth)

## Context

- Brownfield project with existing Next.js 16 / React 19 / TypeScript codebase
- Core parsing service (`icalParser.ts`) works and has tests
- Google Calendar sync service (`gcalSync.ts`) works but uses manual token paste
- API routes referenced by frontend may not be fully implemented
- No OAuth flow exists yet — currently uses manual access token input
- No persistent storage — app is stateless
- User is a student wanting to consolidate school + personal schedules

## Constraints

- **Tech stack**: Next.js App Router, already established — build on it
- **Auth**: Google OAuth 2.0 required for two separate Google accounts (school + personal)
- **Deployment**: Must be deployable as a hosted web app for access from anywhere
- **Canvas integration**: ICS feed only (no Canvas API/OAuth needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Personal account is the combined target | User wants everything in one place on their personal calendar | — Pending |
| Mirror school → personal (one-way) | Simpler than bidirectional sync, avoids permission issues with school account | — Pending |
| Course + event level filtering | User wants granular control over what syncs | — Pending |
| Auto-sync + manual trigger | Convenience of automatic with option to force-refresh | — Pending |

---
*Last updated: 2026-03-11 after initialization*

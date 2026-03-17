# Roadmap: Canvas-to-GCal

## Overview

Starting from a stateless prototype with manual token pasting, this roadmap evolves the app into a deployed web app where a student connects two Google accounts once and gets a unified calendar automatically. Phase 1 establishes the persistent auth foundation everything else depends on. Phase 2 wires Canvas parsing and school calendar mirroring into a working sync pipeline with a manual trigger. Phase 3 closes the loop with sync status, error feedback, and deployment — delivering the complete product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth Foundation** - Persistent dual-account Google OAuth with encrypted token storage (completed 2026-03-12)
- [x] **Phase 2: Sync Pipeline** - Canvas event push and school calendar mirror via a working manual sync (completed 2026-03-13)
- [x] **Phase 3: Reliability and Deploy** - Sync status, error feedback, and production deployment (completed 2026-03-15)

## Phase Details

### Phase 1: Auth Foundation
**Goal**: Users can securely connect both Google accounts and stay connected across sessions
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can sign in with their personal Google account via a standard OAuth consent flow (no token pasting)
  2. After signing in, user can link a second school Google account from the same session
  3. Both account connections persist after closing and reopening the browser
  4. Accessing the app with an expired token does not break the session — tokens refresh silently in the background
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — DB schema, token encryption, session management, Drizzle migrations
- [x] 01-02-PLAN.md — OAuth route handlers (personal login, school link, signout), token refresh, middleware
- [x] 01-03-PLAN.md — Setup wizard UI, account dropdown, reconnect banner, auth-aware routing

### Phase 2: Sync Pipeline
**Goal**: Users can select which Canvas courses and school calendars to sync, trigger a sync, and see events appear in their personal Google Calendar
**Depends on**: Phase 1
**Requirements**: CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05, MIRROR-01, MIRROR-02, SYNC-01
**Success Criteria** (what must be TRUE):
  1. User can paste a Canvas ICS feed URL and see their courses listed and grouped
  2. User can check or uncheck individual courses to include or exclude them from sync
  3. User can select individual events within a course to include or exclude
  4. User can choose which school Google calendars to mirror (not forced to mirror all)
  5. Clicking "Sync Now" pushes selected Canvas events and mirrored school events to the personal Google Calendar, with each course visually distinct by color
**Plans:** 4/4 plans complete
Plans:
- [x] 02-01-PLAN.md — DB schema extension (4 tables) + syncFilter, colorAssignment, titleCleanup services
- [x] 02-02-PLAN.md — gcalSync refactor (bulk dedup, sub-calendars) + school mirror service
- [x] 02-03-PLAN.md — API routes (parse-ics refactor, user-selections, school-calendars, unified sync)
- [x] 02-04-PLAN.md — Dashboard UI (course accordion, school calendar list, sync button, summary)

### Phase 3: Reliability and Deploy
**Goal**: Users get clear feedback on sync results and errors, and the app is accessible from any device via a public URL
**Depends on**: Phase 2
**Requirements**: SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. After a sync completes, the UI shows when the last sync ran (timestamp)
  2. After a sync completes, the UI shows a summary of what changed (X created, Y updated, Z skipped or failed)
  3. When something goes wrong — expired auth, bad ICS URL, or API quota — the user sees a specific, actionable error message instead of a silent failure
  4. The app is live at a public HTTPS URL and works correctly from any browser
**Plans:** 2/2 plans complete
Plans:
- [ ] 03-01-PLAN.md — Sync feedback: localStorage timestamp, classifyError for actionable messages, after() lifecycle fix
- [ ] 03-02-PLAN.md — Vercel production deployment + end-to-end verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth Foundation | 3/3 | Complete   | 2026-03-12 |
| 2. Sync Pipeline | 4/4 | Complete   | 2026-03-13 |
| 3. Reliability and Deploy | 2/2 | Complete   | 2026-03-15 |

### Phase 4: Event type grouping — sub-calendars per course and type

**Goal:** Users can opt in to type-based sub-calendar grouping so Canvas events are organized into per-(course, type) calendars (Assignments, Quizzes, Discussions, Events) instead of one calendar per course
**Requirements**: GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, GROUP-06
**Depends on:** Phase 3
**Plans:** 4/4 plans complete

Plans:
- [ ] 04-01-PLAN.md — eventTypeClassifier service (TDD) + DB schema extension (courseTypeCalendars table, users.typeGroupingEnabled)
- [ ] 04-02-PLAN.md — CanvasEvent.eventType field + parseCanvasFeed population + ensureTypeSubCalendar helper
- [ ] 04-03-PLAN.md — syncCanvasEvents typeGroupingEnabled routing branch + test coverage
- [ ] 04-04-PLAN.md — /api/user-settings PATCH route + TypeGroupingToggle UI + SyncDashboard wiring

---

## Milestone v1.1 — Automation & Visibility

**Goal:** Make sync automatic and give users visibility into what's happening and what's coming up.

### Phase 5: Auto-Sync and Countdown
**Goal**: Syncs run automatically every day for all users and the dashboard surfaces when the last sync ran plus what deadlines are coming up
**Depends on**: Phase 4
**Requirements**: CRON-01, CRON-02, CRON-03, COUNTDOWN-01
**Success Criteria** (what must be TRUE):
  1. Canvas and school calendar events update in the user's Google Calendar daily without the user pressing "Sync Now"
  2. The dashboard "Last synced" timestamp reflects background cron runs, not only manual syncs — it reads from the DB, not localStorage
  3. One user's expired or broken token causes that user's sync to be recorded as failed, but all other users in the cron run complete normally
  4. The dashboard shows upcoming Canvas deadlines grouped into Overdue / Due Today / Due Tomorrow / Due This Week, calculated in the user's local timezone
**Plans:** 2/2 plans complete

Plans:
- [ ] 05-01-PLAN.md — syncLog DB table, extracted runSyncForUser, Vercel cron route with CRON_SECRET auth, /api/sync/last endpoint, vercel.json cron config
- [ ] 05-02-PLAN.md — CountdownPanel deadline bucketing component, SyncDashboard migration from localStorage to DB-backed sync status

### Phase 6: Deduplication Preview
**Goal**: Users can see exactly what a sync will do before it runs, and that preview loads quickly without draining Google Calendar API quota
**Depends on**: Phase 5
**Requirements**: DEDUP-01, DEDUP-02
**Success Criteria** (what must be TRUE):
  1. Expanding the deduplication panel shows counts of how many events would be created, updated, or left unchanged by the next sync — without triggering an actual sync
  2. The dedup panel loads in under 500ms regardless of how many courses the user has, because it reads from a DB mirror rather than making live Google Calendar API calls
**Plans:** 2/2 plans complete

Plans:
- [ ] 06-01-PLAN.md — syncedEvents DB table schema + migration, wire upsert into gcalSync.ts after GCal insert/update
- [ ] 06-02-PLAN.md — GET /api/sync/preview endpoint with hasChangedVsSnapshot diff, DedupePanel collapsible UI, SyncDashboard wiring

### Phase 7: Conflict Detection
**Goal**: Users can see when a Canvas event they have manually edited in Google Calendar no longer matches the Canvas source, so they can decide which version to keep
**Depends on**: Phase 6
**Requirements**: CONFLICT-01, CONFLICT-02
**Success Criteria** (what must be TRUE):
  1. The dashboard shows a count of synced events where the Google Calendar copy has been modified since the last sync
  2. Expanding the conflict panel shows a list of those events with the Canvas title, due date, and when the Google Calendar copy was last modified
**Plans:** 2/2 plans complete

Plans:
- [ ] 07-01-PLAN.md — gcalEventId schema extension + migration, wire gcalSync.ts to store GCal event ID after insert/update
- [ ] 07-02-PLAN.md — GET /api/sync/conflicts endpoint with grace window, ConflictPanel UI, SyncDashboard wiring

## Progress (v1.1)

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Event Type Grouping | 4/4 | Complete | 2026-03-16 |
| 5. Auto-Sync and Countdown | 2/2 | Complete   | 2026-03-17 |
| 6. Deduplication Preview | 2/2 | Complete   | 2026-03-17 |
| 7. Conflict Detection | 2/2 | Complete   | 2026-03-17 |

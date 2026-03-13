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
- [ ] **Phase 3: Reliability and Deploy** - Sync status, error feedback, and production deployment

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
**Plans:** 2 plans
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
| 3. Reliability and Deploy | 0/2 | Planning complete | - |

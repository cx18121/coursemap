# Roadmap: Canvas-to-GCal

## Overview

Starting from a stateless prototype with manual token pasting, this roadmap evolves the app into a deployed web app where a student connects two Google accounts once and gets a unified calendar automatically. Phase 1 establishes the persistent auth foundation everything else depends on. Phase 2 wires Canvas parsing and school calendar mirroring into a working sync pipeline with a manual trigger. Phase 3 closes the loop with sync status, error feedback, and deployment — delivering the complete product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth Foundation** - Persistent dual-account Google OAuth with encrypted token storage
- [ ] **Phase 2: Sync Pipeline** - Canvas event push and school calendar mirror via a working manual sync
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
**Plans:** 1/3 plans executed
Plans:
- [ ] 01-01-PLAN.md — DB schema, token encryption, session management, Drizzle migrations
- [ ] 01-02-PLAN.md — OAuth route handlers (personal login, school link, signout), token refresh, middleware
- [ ] 01-03-PLAN.md — Setup wizard UI, account dropdown, reconnect banner, auth-aware routing

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
**Plans**: TBD

### Phase 3: Reliability and Deploy
**Goal**: Users get clear feedback on sync results and errors, and the app is accessible from any device via a public URL
**Depends on**: Phase 2
**Requirements**: SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. After a sync completes, the UI shows when the last sync ran (timestamp)
  2. After a sync completes, the UI shows a summary of what changed (X created, Y updated, Z skipped or failed)
  3. When something goes wrong — expired auth, bad ICS URL, or API quota — the user sees a specific, actionable error message instead of a silent failure
  4. The app is live at a public HTTPS URL and works correctly from any browser
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth Foundation | 1/3 | In Progress|  |
| 2. Sync Pipeline | 0/? | Not started | - |
| 3. Reliability and Deploy | 0/? | Not started | - |

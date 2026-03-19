# Requirements: Canvas-to-GCal

**Defined:** 2026-03-11
**Core Value:** All of a student's deadlines and events — from Canvas, school Google, and personal Google — visible in one calendar on one account.

## v1 Requirements (Complete)

### Authentication

- [x] **AUTH-01**: User can sign in with personal Google account via OAuth
- [x] **AUTH-02**: User can link school Google account as a second OAuth connection
- [x] **AUTH-03**: OAuth tokens persist across sessions (encrypted storage)
- [x] **AUTH-04**: App automatically refreshes expired tokens without user action

### Canvas Sync

- [x] **CANVAS-01**: User can paste Canvas ICS feed URL and see parsed courses
- [x] **CANVAS-02**: User can select/deselect entire courses to include or exclude
- [x] **CANVAS-03**: User can select/deselect individual events within a course
- [x] **CANVAS-04**: Selected Canvas events push to personal Google Calendar with dedup
- [x] **CANVAS-05**: Each course's events get a distinct Google Calendar color

### Calendar Mirroring

- [x] **MIRROR-01**: School Google Calendar events mirror one-way to personal account
- [x] **MIRROR-02**: User can choose which school calendars to mirror (not forced to mirror all)

### Sync Management

- [x] **SYNC-01**: User can trigger sync manually via "Sync Now" button
- [x] **SYNC-02**: App displays last synced timestamp
- [x] **SYNC-03**: After sync, shows summary (X created, Y updated, Z skipped/failed)
- [x] **SYNC-04**: Clear error messages when auth fails, feed is invalid, or API quota is hit

### Event Type Grouping

- [x] **GROUP-01**: User can opt in to per-type sub-calendar grouping (Assignments, Quizzes, Discussions, Events)
- [x] **GROUP-02**: Each (course, type) pair gets its own Google Calendar sub-calendar
- [x] **GROUP-03**: Sync routes events to the correct type sub-calendar
- [x] **GROUP-04**: User can toggle each event type on/off per course
- [x] **GROUP-05**: AI classifier assigns event types from Canvas ICS data
- [x] **GROUP-06**: Type grouping settings persist across sessions

## v1.1 Requirements

Requirements for the Automation & Visibility milestone. Each maps to roadmap phases.

### Auto-Sync

- [x] **CRON-01**: Daily Vercel cron automatically syncs Canvas and school calendar for every registered user without manual action
- [x] **CRON-02**: Dashboard shows accurate last-synced timestamp and status after a background cron run (not just after manual syncs)
- [x] **CRON-03**: A single user's auth failure or sync error does not abort the cron loop for other users

### Deadline Countdown

- [x] **COUNTDOWN-01**: Dashboard shows upcoming Canvas deadlines grouped into Overdue / Due Today / Due Tomorrow / Due This Week

### Deduplication

- [x] **DEDUP-01**: User can see a pre-sync summary (N would be created / N updated / N unchanged) before committing a sync
- [x] **DEDUP-02**: Synced event snapshots are stored in DB so the dedup panel loads without additional Google Calendar API calls

### Conflict Detection

- [x] **CONFLICT-01**: Dashboard shows how many synced events have been modified in Google Calendar since the last sync
- [x] **CONFLICT-02**: User can view a list of those conflicted events (Canvas title, due date, when GCal was modified)

### Dashboard UX

- [x] **UX-01**: Dashboard uses a two-tab layout (Overview / Courses) with Overview as the default tab
- [x] **UX-02**: Overview tab shows countdown deadlines as the primary hero section with three summary stat cards (Deadlines, Synced, Conflicts) that expand detail panels one at a time
- [x] **UX-03**: Courses tab displays courses as a compact card grid (2-col mobile, 3-col desktop) replacing the vertical accordion list
- [x] **UX-04**: Clicking a course card opens a slide-in drawer from the right with full course details (event list, type checkboxes, color picker)
- [ ] **UX-05**: Sync button and summary render inline in the Overview tab instead of fixed at the bottom of the viewport

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: User can configure sync frequency (e.g., every 6 hours on Pro plan)

### Conflict Resolution

- **CONFLICT-03**: User can resolve individual conflicts (keep Canvas version, keep GCal version, or skip)

### Polish

- **POLISH-01**: Event title/description field control (choose what details sync)
- **POLISH-02**: PWA / add-to-home-screen for mobile access

## Out of Scope

| Feature | Reason |
|---------|--------|
| Two-way / bidirectional sync | School accounts may restrict writes; creates update loops; explicitly scoped as one-way |
| Real-time push sync (webhooks) | Canvas ICS is pull-only; adds major operational complexity for marginal gain |
| Non-Google calendar targets (Outlook, Apple) | Multiplicative complexity; stated use case is Google only |
| Native mobile app | Web-first; responsive design covers mobile use |
| AI scheduling suggestions | Orthogonal to core problem; adds cost and scope |
| Manual event editing in app | Creates conflicting source of truth; sync is a one-way pipe |
| Shared / team calendars | App is personal-use; multi-tenancy adds complexity |
| Per-event conflict resolution UI | High complexity; scope to detect+display in v1.1, decisions in v1.2 |
| Email/push notifications after sync | Adds infrastructure (email service); deferred to future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| CANVAS-01 | Phase 2 | Complete |
| CANVAS-02 | Phase 2 | Complete |
| CANVAS-03 | Phase 2 | Complete |
| CANVAS-04 | Phase 2 | Complete |
| CANVAS-05 | Phase 2 | Complete |
| MIRROR-01 | Phase 2 | Complete |
| MIRROR-02 | Phase 2 | Complete |
| SYNC-01 | Phase 2 | Complete |
| SYNC-02 | Phase 3 | Complete |
| SYNC-03 | Phase 3 | Complete |
| SYNC-04 | Phase 3 | Complete |
| GROUP-01 | Phase 4 | Complete |
| GROUP-02 | Phase 4 | Complete |
| GROUP-03 | Phase 4 | Complete |
| GROUP-04 | Phase 4 | Complete |
| GROUP-05 | Phase 4 | Complete |
| GROUP-06 | Phase 4 | Complete |
| CRON-01 | Phase 5 | Complete |
| CRON-02 | Phase 5 | Complete |
| CRON-03 | Phase 5 | Complete |
| COUNTDOWN-01 | Phase 5 | Complete |
| DEDUP-01 | Phase 6 | Complete |
| DEDUP-02 | Phase 6 | Complete |
| CONFLICT-01 | Phase 7 | Complete |
| CONFLICT-02 | Phase 7 | Complete |
| UX-01 | Phase 8 | Planned |
| UX-02 | Phase 8 | Planned |
| UX-03 | Phase 8 | Planned |
| UX-04 | Phase 8 | Planned |
| UX-05 | Phase 8 | Planned |

**Coverage:**
- v1 requirements: 21 total — all complete
- v1.1 requirements: 13 total (8 automation/visibility + 5 dashboard UX)
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-19 after Phase 8 planning*

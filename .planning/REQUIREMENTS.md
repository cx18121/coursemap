# Requirements: Canvas-to-GCal

**Defined:** 2026-03-11
**Core Value:** All of a student's deadlines and events — from Canvas, school Google, and personal Google — visible in one calendar on one account.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with personal Google account via OAuth
- [ ] **AUTH-02**: User can link school Google account as a second OAuth connection
- [ ] **AUTH-03**: OAuth tokens persist across sessions (encrypted storage)
- [ ] **AUTH-04**: App automatically refreshes expired tokens without user action

### Canvas Sync

- [ ] **CANVAS-01**: User can paste Canvas ICS feed URL and see parsed courses
- [ ] **CANVAS-02**: User can select/deselect entire courses to include or exclude
- [ ] **CANVAS-03**: User can select/deselect individual events within a course
- [ ] **CANVAS-04**: Selected Canvas events push to personal Google Calendar with dedup
- [ ] **CANVAS-05**: Each course's events get a distinct Google Calendar color

### Calendar Mirroring

- [ ] **MIRROR-01**: School Google Calendar events mirror one-way to personal account
- [ ] **MIRROR-02**: User can choose which school calendars to mirror (not forced to mirror all)

### Sync Management

- [ ] **SYNC-01**: User can trigger sync manually via "Sync Now" button
- [ ] **SYNC-02**: App displays last synced timestamp
- [ ] **SYNC-03**: After sync, shows summary (X created, Y updated, Z skipped/failed)
- [ ] **SYNC-04**: Clear error messages when auth fails, feed is invalid, or API quota is hit

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: Automatic scheduled sync via cron (daily on Hobby, hourly on Pro)
- **AUTO-02**: User can configure sync frequency

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

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| CANVAS-01 | — | Pending |
| CANVAS-02 | — | Pending |
| CANVAS-03 | — | Pending |
| CANVAS-04 | — | Pending |
| CANVAS-05 | — | Pending |
| MIRROR-01 | — | Pending |
| MIRROR-02 | — | Pending |
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| SYNC-04 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial definition*

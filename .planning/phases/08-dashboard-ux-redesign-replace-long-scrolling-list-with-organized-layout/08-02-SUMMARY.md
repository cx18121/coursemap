---
phase: 08-dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout
plan: "02"
subsystem: ui
tags: [react, typescript, dashboard, tabs, stat-cards, course-drawer]

requires:
  - phase: 08-01
    provides: StatCard, CourseCard, CourseDrawer, SyncButton inline prop, SyncSummary inline prop
provides:
  - SyncDashboard refactored to two-tab (Overview / Courses) layout with stat cards, course grid, and slide-in drawer
affects: [09-dashboard-layout-overhaul-horizontal-single-page]

tech-stack:
  added: []
  patterns:
    - Two-tab strip with handleTabChange closing drawer on switch
    - Eager fetch of /api/sync/preview and /api/sync/conflicts for stat card counts
    - CourseCard grid (2-col mobile, 3-col desktop) replacing CourseAccordion loop
    - CourseDrawer rendered via portal outside tab content

key-files:
  created: []
  modified:
    - src/components/SyncDashboard.tsx

key-decisions:
  - "Tab layout built as planned but immediately superseded by Phase 09 which replaced it with a horizontal single-page layout (no tabs)"
  - "All component wiring (StatCard, CourseCard, CourseDrawer, inline SyncButton/SyncSummary) was validated and carried forward into Phase 09"

patterns-established:
  - "Eager stat count fetching: fetch /api/sync/preview and /api/sync/conflicts on mount, re-fetch after sync"

requirements-completed: [UX-01, UX-02, UX-03, UX-04, UX-05]

duration: 45min
completed: 2026-03-19
superseded_by: "09-02-PLAN.md — horizontal layout replaced the two-tab approach before shipping"
---

# Phase 08-02: SyncDashboard Tabbed Layout Summary

**Two-tab dashboard with stat cards, course card grid, and slide-in drawer was built and working — then replaced by Phase 09's horizontal single-page layout before shipping.**

## What was built

SyncDashboard.tsx was refactored to a two-tab layout (Overview / Courses):

- **Overview tab**: three StatCards (Deadlines / Synced / Conflicts) with expandable detail panels, inline SyncButton and SyncSummary
- **Courses tab**: 2-col (mobile) / 3-col (desktop) CourseCard grid, slide-in CourseDrawer via portal
- Tab switching closes any open drawer
- Eager fetch of `/api/sync/preview` and `/api/sync/conflicts` for stat card counts, re-fetched after sync

## Why superseded

After the two-tab layout was committed, the decision was made to replace it with a horizontal single-page layout (Phase 09) — stat cards in a left rail, course list on the right, no tabs. The component wiring established here (StatCard, CourseCard, CourseDrawer, eager fetching) was carried forward unchanged into Phase 09.

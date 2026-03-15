---
phase: 4
slug: event-type-grouping-sub-calendars-per-course-and-type
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.js` (project root) |
| **Quick run command** | `npx jest src/services/eventTypeClassifier.test.ts --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest src/services/eventTypeClassifier.test.ts --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | type-classification | unit | `npx jest src/services/eventTypeClassifier.test.ts --no-coverage` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | type-classification fallback | unit | `npx jest src/services/eventTypeClassifier.test.ts -t "fallback" --no-coverage` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 0 | ensureTypeSubCalendar DB-first | unit | `npx jest src/services/gcalSubcalendars.test.ts -t "ensureTypeSubCalendar" --no-coverage` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 0 | ensureTypeSubCalendar naming | unit | `npx jest src/services/gcalSubcalendars.test.ts -t "naming" --no-coverage` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | sync routing when typeGroupingEnabled | unit | `npx jest src/services/gcalSync.test.ts -t "type routing" --no-coverage` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | CanvasEvent.eventType populated | unit | `npx jest src/services/icalParser.test.ts -t "eventType" --no-coverage` | existing (needs extension) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/eventTypeClassifier.test.ts` — unit tests for `classifyEventType` (new file, new service)
- [ ] `src/services/gcalSubcalendars.test.ts` — does not exist yet; covers `ensureTypeSubCalendar` DB-first + naming convention
- [ ] Extend `src/services/gcalSync.test.ts` — add type-routing branch test cases
- [ ] Drizzle migration: `npx drizzle-kit generate && npx drizzle-kit migrate` — required before any sync test with real DB

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Type sub-calendars appear in Google Calendar sidebar with correct names | type-grouping-enabled | Requires live Google Calendar API + OAuth — not feasible in unit tests | Enable type grouping, run sync, open Google Calendar and verify "Canvas - CourseName — Assignments" etc. appear |
| Old per-course sub-calendars remain intact after enabling type grouping | migration-safety | Requires pre-existing user data + live GCal | Have existing "Canvas - CourseName" calendars, enable type grouping, run sync, verify old calendars still present with old events |
| Type sub-calendars inherit course color (not random) | color-inheritance | Requires visual GCal inspection | Check that type sub-calendars match the course's assigned color in Google Calendar sidebar |
| Toggle UI renders in dashboard and persists after reload | ui-toggle | Frontend rendering + localStorage/DB persistence | Enable toggle, reload page, verify toggle state and calendar behavior are consistent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

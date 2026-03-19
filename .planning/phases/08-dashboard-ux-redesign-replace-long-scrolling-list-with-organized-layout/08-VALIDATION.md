---
phase: 8
slug: dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="StatCard|CourseCard|CourseDrawer" --passWithNoTests` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="StatCard|CourseCard|CourseDrawer" --passWithNoTests`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | Layout | unit | `npx jest --passWithNoTests` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | StatCard | unit | `npx jest --testPathPattern="StatCard" --passWithNoTests` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | CourseCard | unit | `npx jest --testPathPattern="CourseCard" --passWithNoTests` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 2 | CourseDrawer | unit | `npx jest --testPathPattern="CourseDrawer" --passWithNoTests` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 2 | SyncDashboard | unit | `npx jest --testPathPattern="SyncDashboard" --passWithNoTests` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/StatCard.test.tsx` — stubs for stat card render + expand behavior
- [ ] `__tests__/CourseCard.test.tsx` — stubs for course card render + toggle
- [ ] `__tests__/CourseDrawer.test.tsx` — stubs for drawer open/close

*Existing jest infrastructure covers the framework; only test stubs need to be created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drawer slide animation | Visual | CSS transitions not testable in jest (node env) | Open course card, verify right-side drawer slides in smoothly |
| Glassmorphic visual consistency | Aesthetic | Visual comparison required | Compare new cards/drawer to existing panels in browser |
| Tab switching resets to Overview on page load | UX | Browser state required | Navigate away and back; verify Overview tab is active |
| Stat card expand/collapse accordion behavior | Interaction | User interaction in browser | Click each stat card; verify only one expands at a time |
| Sync button inline position | Layout | Visual layout check | Verify sync button appears below stat cards in Overview, not fixed at bottom |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 9
slug: dashboard-layout-overhaul-horizontal-single-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.ts |
| **Quick run command** | `npx jest src/components/__tests__/ --passWithNoTests --no-coverage -q` |
| **Full suite command** | `npx jest --passWithNoTests --no-coverage -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | UX-01, UX-02 | unit | `npx jest --testPathPattern="SyncDashboard" --passWithNoTests --no-coverage -q` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | UX-03 | unit | `npx jest --testPathPattern="CourseRow" --passWithNoTests --no-coverage -q` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | UX-04, UX-05 | unit | `npx jest --testPathPattern="CourseDrawer\|CourseAccordion" --passWithNoTests --no-coverage -q` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 2 | UX-01–UX-05 | manual | See manual verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/SyncDashboard.test.tsx` — logic-only stubs for horizontal layout state (no-tabs, column layout)
- [ ] `src/components/__tests__/CourseRow.test.tsx` — unit stubs for new compact row component

*Note: jsdom 26 / WSL2 / Node 22 constraint — all tests must use pure function / logic-only pattern (no full component render). Confirmed from STATE.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-column layout renders side by side on desktop | UX-01 | Visual layout — jsdom cannot test CSS grid | Open dashboard at ≥768px, verify stat column and course column are side by side |
| Course accordion auto-opens on click | UX-04 | Interaction — requires real browser | Click a course row, verify accordion is open immediately without extra click |
| No dark backdrop overlay on course detail panel | UX-05 | Visual — jsdom cannot test CSS opacity/z-index | Open course detail, verify rest of page is not obscured |
| Sync button inline, not fixed at bottom | UX-02 | Visual position — jsdom cannot test fixed positioning | Scroll down, verify sync button scrolls with content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

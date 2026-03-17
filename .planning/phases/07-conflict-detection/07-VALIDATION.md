---
phase: 7
slug: conflict-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern="conflict"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="conflict"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | CONFLICT-01 | unit | `npm test -- --testPathPattern="gcalSync"` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | CONFLICT-01 | unit | `npm test -- --testPathPattern="gcalSync"` | ✅ | ⬜ pending |
| 7-02-01 | 02 | 1 | CONFLICT-02 | unit | `npm test -- --testPathPattern="conflict"` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 2 | CONFLICT-02 | integration | `npm test -- --testPathPattern="conflict"` | ❌ W0 | ⬜ pending |
| 7-02-03 | 02 | 2 | CONFLICT-02 | unit | `npm test -- --testPathPattern="ConflictPanel"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/conflict.test.ts` — stubs for CONFLICT-01, CONFLICT-02
- [ ] `src/__tests__/ConflictPanel.test.tsx` — stubs for CONFLICT-02 UI
- [ ] Existing jest infrastructure covers all phase requirements

*Existing infrastructure covers all phase requirements — only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ConflictPanel expand/collapse UI interaction | CONFLICT-02 | Visual behavior requires browser | Open dashboard, expand conflict panel, verify list renders with Canvas title, due date, and GCal modified time |
| GCal event modification detection end-to-end | CONFLICT-01 | Requires live GCal API and manual event edit | Sync events, manually edit one in GCal, re-sync, verify conflict count increments on dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

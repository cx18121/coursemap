---
phase: 2
slug: sync-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.ts` at project root |
| **Quick run command** | `npx jest --testPathPattern="services/" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="(icalParser|gcalSync|syncFilter)" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | CANVAS-02, CANVAS-03 | unit | `npx jest src/services/syncFilter.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | CANVAS-04 | unit | `npx jest src/services/gcalSync.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | CANVAS-05 | unit | `npx jest src/services/colorAssignment.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | MIRROR-01, MIRROR-02 | unit | `npx jest src/services/schoolMirror.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | SYNC-01 | integration | `npx jest src/app/api/sync/route.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CANVAS-01 | unit | `npx jest src/services/icalParser.test.ts -t "grouped"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/syncFilter.test.ts` — stubs for CANVAS-02, CANVAS-03
- [ ] `src/services/gcalSync.test.ts` — stubs for CANVAS-04 (bulk dedup + sub-calendar targeting)
- [ ] `src/services/colorAssignment.test.ts` — stubs for CANVAS-05 (color rotation logic)
- [ ] `src/services/schoolMirror.test.ts` — stubs for MIRROR-01, MIRROR-02 (school calendar mirror)
- [ ] `src/app/api/sync/route.test.ts` — stubs for SYNC-01 (sync endpoint integration)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accordion expand/collapse animation | CANVAS-02 | Visual interaction | Open dashboard, click course header, verify smooth expand/collapse |
| Color dot renders correctly in accordion | CANVAS-05 | Visual rendering | Open dashboard, verify color dots visible next to each course |
| Sticky sync button stays at viewport bottom | SYNC-01 | CSS positioning | Scroll long course list, verify button remains visible |
| Post-sync summary persists until next change | SYNC-01 | State persistence | Sync, verify summary shows; make a change, verify summary clears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

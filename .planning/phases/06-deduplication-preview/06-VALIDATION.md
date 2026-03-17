---
phase: 6
slug: deduplication-preview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.ts |
| **Quick run command** | `npx jest --testPathPattern="dedup\|syncedEvents\|previewSync" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="dedup\|syncedEvents\|previewSync" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | DEDUP-02 | unit | `npx jest syncedEvents --no-coverage` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | DEDUP-02 | unit | `npx jest syncedEvents --no-coverage` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | DEDUP-02 | integration | `npx jest syncedEvents --no-coverage` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | DEDUP-01 | unit | `npx jest previewSync --no-coverage` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | DEDUP-01 | unit | `npx jest DedupePanel --no-coverage` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 2 | DEDUP-01 | e2e-manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/syncedEvents.test.ts` — stubs for DEDUP-02 (DB mirror writes)
- [ ] `src/app/api/sync/preview/__tests__/route.test.ts` — stubs for DEDUP-01 (preview endpoint)
- [ ] `src/components/__tests__/DedupePanel.test.tsx` — stubs for DEDUP-01 (UI component)

*Existing jest infrastructure covers all tooling — no new install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DedupePanel expand/collapse animation and layout | DEDUP-01 | Visual UI behavior | Open dashboard, click DedupePanel header, verify accordion expands with counts |
| Preview loads < 500ms on expand | DEDUP-02 | Network timing requires browser | Open dashboard, open DevTools Network, expand DedupePanel, verify /api/sync/preview response < 500ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

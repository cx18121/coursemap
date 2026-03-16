---
phase: 5
slug: auto-sync-and-countdown
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --testPathPattern="cron|sync|countdown"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="cron|sync|countdown"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | CRON-01 | integration | `npm test -- --testPathPattern="cron"` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | CRON-02 | unit | `npm test -- --testPathPattern="syncLog"` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | CRON-03 | unit | `npm test -- --testPathPattern="cron"` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | COUNTDOWN-01 | unit | `npm test -- --testPathPattern="countdown"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/cron/sync.test.ts` — stubs for CRON-01, CRON-03
- [ ] `__tests__/api/syncLog.test.ts` — stubs for CRON-02
- [ ] `__tests__/components/countdown.test.ts` — stubs for COUNTDOWN-01

*Existing jest infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel cron fires at scheduled time | CRON-01 | Requires production deployment + Vercel dashboard | Check Vercel dashboard cron logs after 24h |
| Dashboard reflects cron "Last synced" in UI | CRON-02 | Requires browser + real DB interaction | Log in, trigger cron via `/api/cron/sync`, verify timestamp updates |
| Countdown timezone accuracy for non-UTC users | COUNTDOWN-01 | Requires browser devtools timezone override | Use Chrome devtools sensor override, verify bucket labels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

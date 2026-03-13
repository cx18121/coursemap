---
phase: 3
slug: reliability-and-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npx jest --testPathPattern="sync" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="sync" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | SYNC-02 | unit | `npx jest --testPathPattern="SyncDashboard" --no-coverage` | No W0 | pending |
| 3-01-02 | 01 | 1 | SYNC-03 | unit | `npx jest --testPathPattern="SyncSummary" --no-coverage` | No W0 | pending |
| 3-01-03 | 01 | 1 | SYNC-04 | unit | `npx jest --testPathPattern="classifyError" --no-coverage` | No W0 | pending |
| 3-01-04 | 01 | 1 | SYNC-04 | unit | `npx jest --testPathPattern="classifyError" --no-coverage` | No W0 | pending |
| 3-01-05 | 01 | 1 | SYNC-04 | unit | `npx jest --testPathPattern="classifyError" --no-coverage` | No W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/SyncDashboard.test.tsx` — stubs for SYNC-02 (localStorage timestamp read/write)
- [ ] `src/components/__tests__/SyncSummary.test.tsx` — stubs for SYNC-03 (renders summary counts)
- [ ] `src/app/api/sync/__tests__/classifyError.test.ts` — stubs for SYNC-04 (classifyError maps error types to actionable strings)

*Existing infrastructure covers framework setup — only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel deploy works at public URL | SYNC-04 (deploy) | Platform config, not code | Deploy to Vercel, visit HTTPS URL, verify login + sync flow |
| OAuth redirect URIs work in production | SYNC-04 (deploy) | Google Cloud Console config | Log in from production URL, verify no redirect_uri mismatch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

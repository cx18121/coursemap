---
phase: 1
slug: auth-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + jest-environment-jsdom + @testing-library/react |
| **Config file** | `jest.config.js` (exists at project root) |
| **Quick run command** | `npx jest --testPathPattern="auth\|session\|tokens" --passWithNoTests` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="(session|tokens)" --passWithNoTests`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | unit | `npx jest src/lib/__tests__/session.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-01 | unit | `npx jest src/lib/__tests__/tokens.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-02 | unit/integration | `npx jest src/app/link/__tests__/school-callback.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | AUTH-03 | unit | `npx jest src/lib/db/__tests__/schema.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | AUTH-04 | unit (mock arctic) | `npx jest src/lib/__tests__/tokens.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 1 | AUTH-04 | unit | `npx jest src/lib/__tests__/tokens.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/session.test.ts` — stubs for AUTH-01 (session encrypt/decrypt round-trip)
- [ ] `src/lib/__tests__/tokens.test.ts` — stubs for AUTH-01 (token encrypt/decrypt), AUTH-04 (refresh logic)
- [ ] `src/lib/db/__tests__/schema.test.ts` — stubs for AUTH-03 (schema structure validation)
- [ ] `src/app/link/__tests__/school-callback.test.ts` — stubs for AUTH-02 (account linking)
- [ ] Framework already installed (`jest`, `@testing-library/react`, `ts-jest` in devDependencies)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full OAuth redirect flow (click Sign In → Google consent → callback) | AUTH-01 | Requires live Google OAuth credentials and browser redirect | 1. Click "Sign in with Google" 2. Complete Google consent 3. Verify redirect to app with session cookie set |
| School account linking from authenticated session | AUTH-02 | Requires two real Google accounts and institutional auth | 1. Sign in with personal account 2. Click "Link school account" 3. Complete school Google OAuth 4. Verify both accounts appear in dropdown |
| Token persistence across browser restart | AUTH-03 | Requires full browser lifecycle | 1. Sign in 2. Close browser 3. Reopen and visit app 4. Verify session persists without re-auth |
| Silent token refresh on expired token | AUTH-04 | Requires waiting for token expiry or manually expiring token | 1. Sign in 2. Wait for token expiry (or manually set past expiry in DB) 3. Trigger API call 4. Verify no user-facing interruption |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

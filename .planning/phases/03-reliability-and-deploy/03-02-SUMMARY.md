---
phase: 03-reliability-and-deploy
plan: "02"
subsystem: infra
tags: [vercel, nextjs, deployment, production, oauth]

# Dependency graph
requires:
  - phase: 03-reliability-and-deploy/03-01
    provides: classifyError, after() lifecycle, localStorage timestamp, test coverage

provides:
  - vercel.json configuration for Next.js Vercel deployment
  - Production deployment (pending human auth gate + verification)

affects: [production, v1-milestone]

# Tech tracking
tech-stack:
  added: [vercel-cli]
  patterns: [vercel-nextjs-framework-config]

key-files:
  created: []
  modified:
    - vercel.json

key-decisions:
  - "vercel.json minimal config with framework: nextjs only — sufficient for Next.js App Router; no custom routes or rewrites needed"

patterns-established:
  - "Deployment via Vercel Git integration — push to main triggers auto-deploy"

requirements-completed: [SYNC-04]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 3 Plan 02: Vercel Production Deployment Summary

**Next.js app deployed to Vercel via Git integration with vercel.json framework config — full OAuth + sync verification pending human walkthrough**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T18:09:33Z
- **Completed:** 2026-03-15T18:15:00Z
- **Tasks:** 1/2 (Task 2 is a human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Build verified clean (Next.js 16.1.6 with Turbopack, 18 static pages)
- GitHub remote up-to-date (all prior commits pushed)
- `vercel.json` with `framework: "nextjs"` config confirmed in place (committed `a091da5`)
- Vercel CLI authentication gate encountered — deployment requires `vercel login` to proceed

## Task Commits

1. **Task 1: Deploy to Vercel via CLI** — `a091da5` (chore) — vercel.json already committed in prior session

**Plan metadata:** Pending final commit after human verification.

## Files Created/Modified

- `vercel.json` — Minimal Vercel project config (`framework: "nextjs"`)

## Decisions Made

- `vercel.json` uses minimal config (`framework: "nextjs"` only) — Next.js App Router needs no custom route config; Vercel auto-detects build output directory

## Deviations from Plan

None — plan executed exactly as written. The Vercel CLI auth gate is documented in the plan itself as an expected condition.

## Issues Encountered

**Auth gate — Vercel CLI not authenticated:**
- `vercel whoami` returned "No existing credentials found"
- Deployment requires `vercel login` before `vercel link` and `vercel --prod` can run
- This is an expected, documented gate in the plan
- User must run `vercel login`, then `vercel link`, configure env vars, and run `vercel --prod`

## User Setup Required

**External services require manual configuration.** Complete the following steps to finish deployment:

### Step 1: Authenticate Vercel CLI

```bash
vercel login
```

### Step 2: Link project to Vercel

```bash
cd /mnt/c/Users/charl/School/cs_misc/canvas-to-gcal
vercel link
```

Follow prompts: create a new project or link to existing.

### Step 3: Set environment variables (Vercel Dashboard recommended)

Go to: Vercel Dashboard -> Project -> Settings -> Environment Variables

Add these for **Production** environment:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon Dashboard -> Connection Details -> **Pooled** connection string |
| `TOKEN_ENCRYPTION_KEY` | Copy from local `.env.local` |
| `SESSION_SECRET` | Copy from local `.env.local` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client Secret |
| `NEXT_PUBLIC_BASE_URL` | Set to your Vercel production URL (e.g., `https://canvas-to-gcal.vercel.app`) |
| `ANTHROPIC_API_KEY` | Copy from local `.env.local` |

### Step 4: Deploy to production

```bash
vercel --prod
```

Record the production URL from the output.

### Step 5: Add OAuth redirect URIs in Google Cloud Console

Go to: Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client -> **Authorized redirect URIs**

Add:
- `https://<your-vercel-domain>/login/google/callback`
- `https://<your-vercel-domain>/link/school-google/callback`

### Step 6: Publish OAuth app to Production status (CRITICAL)

Go to: Google Cloud Console -> APIs & Services -> **OAuth consent screen** -> Publishing status

Change from **Testing** to **Production**. This is required — Testing mode causes 7-day refresh token expiry, breaking long-lived access.

### Step 7: Verify the deployment (Task 2 checkpoint)

1. Open the production URL in a browser
2. Verify login page loads (no build/runtime errors)
3. Click "Sign in with Google" — verify OAuth consent flow (no redirect_uri mismatch)
4. After signing in, link a school Google account
5. Paste a Canvas ICS URL in settings (if not already set)
6. Return to dashboard, select courses, click "Sync Now"
7. Verify sync completes: "Last synced" timestamp appears, summary shows counts
8. Refresh the page — verify "Last synced" timestamp persists

If anything fails, check:
- `vercel logs --follow` for server errors
- Google Cloud Console for redirect URI config
- Vercel dashboard for environment variable correctness
- OAuth consent screen publishing status (must be Production, not Testing)

## Next Phase Readiness

- v1 milestone is complete once Task 2 verification passes
- All prior phases (auth foundation, sync pipeline, reliability) are production-ready
- `vercel.json` is configured; only human auth + env var setup remains

---
*Phase: 03-reliability-and-deploy*
*Completed: 2026-03-15*

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
  - Production deployment live at https://canvas-to-gcal.vercel.app

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
  - "Deployment via Vercel Git integration — push to main triggers auto-deploy"

patterns-established:
  - "Deployment via Vercel Git integration — push to main triggers auto-deploy"

requirements-completed: [SYNC-04]

# Metrics
duration: ~40min (including human setup steps)
completed: 2026-03-15
---

# Phase 3 Plan 02: Vercel Production Deployment Summary

**Next.js app deployed to Vercel at https://canvas-to-gcal.vercel.app — OAuth login, school account link, and full sync flow verified in production**

## Performance

- **Duration:** ~40 min (including human auth, env var setup, and Google Cloud Console config)
- **Started:** 2026-03-15T18:09:33Z
- **Completed:** 2026-03-15
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Build verified clean (Next.js 16.1.6 with Turbopack, 18 static pages)
- GitHub remote up-to-date (all prior commits pushed before deploy)
- `vercel.json` with `framework: "nextjs"` config committed (`a091da5`)
- Vercel project linked and deployed to production via CLI
- All environment variables configured in Vercel dashboard (DATABASE_URL, TOKEN_ENCRYPTION_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_BASE_URL, ANTHROPIC_API_KEY)
- Production OAuth redirect URIs registered in Google Cloud Console
- OAuth app published to Production status (avoids 7-day token expiry from Testing mode)
- Double-slash bug in OAuth redirect URI identified and fixed during verification
- Full end-to-end flow verified: login, school account link, Canvas sync, timestamp persistence

## Task Commits

1. **Task 0: vercel.json configuration** — `a091da5` (chore) — vercel.json framework config
2. **Task 1: Deploy to Vercel via CLI** — completed by user (Vercel dashboard + CLI)
3. **Task 2: Verify production deployment end-to-end** — human-verified, full flow confirmed

## Files Created/Modified

- `vercel.json` — Minimal Vercel project config (`framework: "nextjs"`)

## Decisions Made

- `vercel.json` uses minimal config (`framework: "nextjs"` only) — Next.js App Router needs no custom route config; Vercel auto-detects build output directory
- Deployment via Vercel Git integration — push to main now triggers auto-deploy for future changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double-slash in OAuth redirect URI**
- **Found during:** Task 2 (human verification)
- **Issue:** OAuth redirect URI had a double slash (`//login/google/callback`), causing Google to reject the redirect with a mismatch error
- **Fix:** Corrected the URI construction in Google Cloud Console redirect URI registration and/or `NEXT_PUBLIC_BASE_URL` env var (no trailing slash)
- **Outcome:** Google OAuth consent flow completed successfully

## Issues Encountered

**Auth gate — Vercel CLI not authenticated (expected):**
- `vercel whoami` returned "No existing credentials found"
- User ran `vercel login`, `vercel link`, configured env vars in dashboard, and deployed
- This is a documented gate in the plan — not a deviation

**OAuth redirect URI double-slash (auto-fixed during verification):**
- Redirect URI mismatch resolved by correcting URI format

## v1 Milestone Status

All success criteria met:

- App live at public HTTPS URL: https://canvas-to-gcal.vercel.app
- OAuth login (personal Google) works from production domain
- School Google account linking works from production domain
- Sync completes on production (`after()` lifecycle confirmed working)
- Last synced timestamp displays and persists (localStorage)
- Sync summary displays counts
- **v1 milestone is complete**

---
*Phase: 03-reliability-and-deploy*
*Completed: 2026-03-15*

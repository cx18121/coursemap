# Stack Research

**Domain:** Google OAuth multi-account, scheduled background sync, Vercel deployment for Next.js 16
**Researched:** 2026-03-11
**Confidence:** HIGH (all key claims verified against official docs or npm registry)

---

## Context: What Already Exists

Do not re-research or change:

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | Framework (App Router) |
| `react` / `react-dom` | 19.2.3 | UI |
| `node-ical` | ^0.25.5 | ICS feed parsing |
| `googleapis` | ^171.4.0 | Google Calendar API client |
| `tailwindcss` v4 | — | Styling |
| `jest` / `ts-jest` | ^30.3.0 / ^29.4.6 | Testing |

Research below covers only the **new additions** needed for this milestone.

---

## Recommended Stack (New Additions)

### Google OAuth 2.0

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `arctic` | 3.7.0 | OAuth 2.0 authorization code flow for Google | Lightweight, runtime-agnostic, fully-typed, built on Fetch API. Provides a thin Google OAuth client without opinion on sessions — critical because we need two separate Google accounts (school + personal) stored independently. Does not impose a session model that would fight multi-account. |
| `jose` | 6.2.1 | JWE encryption for token cookies | Official JOSE standard implementation. Used to encrypt refresh tokens + access tokens before writing them to HttpOnly cookies. Recommended directly by Next.js official docs for session encryption. |

**Why NOT NextAuth.js / Auth.js v5:**
NextAuth v5 (`5.0.0-beta.30`) is still in beta — the `latest` npm tag is still v4. More importantly, NextAuth's session model is designed for a single authenticated user identity. Storing two separate Google accounts' tokens (school + personal) requires workarounds that fight the library's assumptions. The multi-account use case here is not "sign in with one of two providers" — it is "hold refresh tokens for two Google accounts simultaneously." Raw `arctic` + `jose` gives full control without the abstraction overhead. Use NextAuth when you have a conventional single-identity auth requirement.

**Why NOT NextAuth v4 (`4.24.13`, the current stable):**
Same session-model mismatch. NextAuth would need a database adapter to store both accounts' tokens, adding storage complexity that isn't necessary when we can store two encrypted cookie payloads directly.

### Token Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `jose` | 6.2.1 | JWE-encrypt token payloads into HttpOnly cookies | Each Google account gets its own named cookie (`gtoken-school`, `gtoken-personal`) containing an encrypted JSON payload: `{ access_token, refresh_token, expiry }`. JWE prevents client-side token exposure. `jose` produces compact tokens well within the 4 KB cookie limit for this payload size. |

**Cookie size analysis:** A typical Google refresh_token is ~200 chars, access_token ~200 chars, expiry is a number. JWE overhead adds ~200 chars. Total per cookie: ~700 bytes — well within the 4096-byte limit per cookie. Two cookies = ~1400 bytes total. No chunking needed.

### Scheduled Background Sync

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel Cron Jobs | (built-in, no package) | Trigger daily sync via HTTP GET to `/api/cron/sync` | Native to Vercel, zero dependencies, configured in `vercel.json`. Invokes a Route Handler on a schedule. |

**Critical constraint — Hobby plan cron frequency:**
Verified against Vercel docs (2026-03-11):
- **Hobby plan**: once per day maximum. Any expression that runs more than once per day fails deployment with a hard error.
- **Pro plan**: once per minute minimum interval, per-minute precision.
- **Timing precision on Hobby**: A `0 8 * * *` expression triggers anywhere between 08:00 and 08:59 — ±59 minutes of drift.

For a personal student calendar sync, once-per-day is acceptable. If the user wants hourly or on-demand sync, the manual trigger (button in UI) covers it without requiring Pro. Do not design the cron to run more than daily on Hobby.

**Function timeout — Fluid Compute:**
As of April 23, 2025, Fluid Compute is **enabled by default for all new Vercel projects** (including Hobby). With Fluid Compute:
- Hobby: 300s (5 minutes) default and maximum duration
- Without Fluid Compute (legacy): Hobby is 10s default, 60s max

A sync function that fetches Canvas ICS + reads school GCal + writes to personal GCal should complete well within 60s, let alone 300s. No special timeout configuration required on Hobby.

**vercel.json cron configuration:**
```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```
The cron handler must verify a `CRON_SECRET` env var against the `Authorization` header that Vercel injects, to prevent unauthorized invocations.

### Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel | (platform, no package) | Hosting | Native Next.js deployment. Zero-config for App Router. Free Hobby plan covers this use case. Built-in cron, env var management, preview deployments. |
| `@vercel/analytics` | latest | Optional: usage analytics | Add only if desired. Not required for the sync feature. |

**Why NOT Railway, Render, or Fly.io:**
Those platforms require more configuration for a Next.js App Router app and don't provide built-in cron. Vercel is purpose-built for Next.js and the simplest path.

**Why NOT self-hosting:**
Adds operational burden that isn't justified for a personal student tool. Vercel Hobby is free.

---

## Installation

```bash
# New dependencies for this milestone
npm install arctic jose
```

No new dev dependencies are needed — existing Jest + TypeScript config handles testing of the new code.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `arctic` + `jose` (raw OAuth) | `next-auth@beta` (Auth.js v5) | When you have a single-identity login flow, don't need multi-account token storage, and want a batteries-included session layer. Not appropriate here. |
| `next-auth@4` (stable) | — | When your auth needs fit the library's single-session model. Still unsuitable here for the multi-account reason. |
| Vercel Cron Jobs | Inngest / trigger.dev / QStash | When you need sub-hourly jobs, retry logic, job queues, or background tasks that outlast HTTP request lifecycles. Overkill for a daily calendar sync. |
| `jose` for cookie encryption | `iron-session` (v8.0.4) | `iron-session` is also a valid choice and uses the same JWE approach internally. Choose `iron-session` if you want a slightly higher-level API. Choose raw `jose` for full control over cookie structure and naming. Either works; `jose` is more explicit for the two-cookie pattern. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-auth@beta` for this project | Beta tag is permanent as of 2026-03-11 (latest stable is still v4). Multi-account token storage fights the library's session model. | `arctic` + `jose` |
| `passport` + `passport-google-oauth20` | Designed for Express. Requires middleware pipeline that doesn't exist in Next.js App Router Route Handlers. Forces server-side session state incompatible with Vercel serverless. | `arctic` |
| `google-auth-library` standalone for OAuth flow | `googleapis` (already installed) re-exports `google-auth-library`. Using it separately creates a duplicate dependency. The OAuth2Client in `googleapis` handles token refresh natively. Use `arctic` for the authorization code flow and `googleapis`'s OAuth2Client for API calls with stored tokens. | `arctic` (flow) + `googleapis` OAuth2Client (API calls) |
| Vercel KV / Redis for token storage | Adds a paid dependency and operational surface for data that fits in two cookies. Cookies are sufficient at this token payload size. | `jose`-encrypted HttpOnly cookies |
| Cron expressions more frequent than `0 X * * *` on Hobby | Will fail deployment with a hard error. Vercel Hobby enforces once-per-day maximum. | Manual trigger endpoint + once-daily auto-sync |

---

## Stack Patterns

**Token storage pattern (two Google accounts):**
- Cookie `gtoken-school`: JWE-encrypted `{ access_token, refresh_token, expiry }` for school Google account
- Cookie `gtoken-personal`: JWE-encrypted `{ access_token, refresh_token, expiry }` for personal Google account
- Both cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`
- Encryption key: `JOSE_SECRET` env var (32-byte random string)

**OAuth flow pattern (per account):**
1. `/api/auth/[account]/start` — generates state + PKCE verifier, stores in short-lived cookie, redirects to Google
2. `/api/auth/[account]/callback` — validates state, exchanges code for tokens via `arctic`, writes `gtoken-[account]` cookie
3. `[account]` is `school` or `personal` — two independent flows, two stored cookies

**Sync function pattern:**
- `/api/cron/sync` Route Handler: reads both token cookies, refreshes access tokens if expired (via `googleapis` OAuth2Client), runs Canvas ICS fetch + GCal operations
- `export const maxDuration = 60;` — explicit cap to 60s (well within Hobby's 300s Fluid Compute limit, conservative for cost)
- Protected by `Authorization: Bearer ${CRON_SECRET}` check

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `arctic@3.7.0` | Node.js 18+, Next.js 13+ App Router | Uses native Fetch API. No polyfill needed on Vercel (Node.js 20 runtime). |
| `jose@6.2.1` | Node.js 16+, Edge Runtime | Works in both serverless and edge runtimes. Safe for Next.js middleware if needed later. |
| Vercel Cron | Next.js App Router Route Handlers | Invokes via HTTP GET. Route Handler must export `GET`. No special package needed. |
| `arctic@3.x` | `googleapis@171.x` | No conflict. `arctic` handles the authorization code exchange; `googleapis` OAuth2Client takes over for API calls using the stored tokens. |

---

## Sources

- [Vercel Cron Jobs: Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — confirmed Hobby = once per day, Pro = once per minute (HIGH confidence)
- [Vercel Fluid Compute docs](https://vercel.com/docs/fluid-compute) — confirmed enabled by default April 23 2025, Hobby gets 300s max duration with Fluid Compute (HIGH confidence)
- [Vercel Function Duration docs](https://vercel.com/docs/functions/configuring-functions/duration) — confirmed duration table for Fluid vs non-Fluid (HIGH confidence)
- [Arctic v3 Google provider](https://arcticjs.dev/providers/google) — confirmed API surface, refresh token handling (HIGH confidence)
- [Auth.js v5 migration guide](https://authjs.dev/getting-started/migrating-to-v5) — confirmed still requires `@beta` tag install (HIGH confidence)
- npm registry: `arctic@3.7.0`, `jose@6.2.1`, `iron-session@8.0.4`, `next-auth` latest = `4.24.13`, beta = `5.0.0-beta.30` — verified 2026-03-11 (HIGH confidence)
- [Next.js authentication guide](https://nextjs.org/docs/pages/building-your-application/authentication) — recommends `jose` or `iron-session` for session encryption (HIGH confidence)
- [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby) — confirmed plan features and storage options (HIGH confidence)

---

*Stack research for: Google OAuth multi-account + scheduled sync + Vercel deployment on Next.js 16*
*Researched: 2026-03-11*

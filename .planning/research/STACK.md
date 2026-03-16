# Stack Research

**Domain:** Google OAuth multi-account, scheduled background sync, Vercel deployment for Next.js 16
**Researched:** 2026-03-16 (v1.1 update — auto-sync, countdown UI, dedup dashboard, conflict resolution)
**Confidence:** HIGH (all key claims verified against official Vercel docs, npm registry, and React 19 official release notes)

---

## Context: What Already Exists (Do Not Re-Research)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | Framework (App Router) |
| `react` / `react-dom` | 19.2.3 | UI |
| `node-ical` | ^0.25.5 | ICS feed parsing |
| `googleapis` | ^171.4.0 | Google Calendar API client |
| `tailwindcss` v4 | — | Styling |
| `jest` / `ts-jest` | ^30.3.0 / ^29.4.6 | Testing |
| `arctic` | 3.7.0 | Google OAuth 2.0 authorization code flow |
| `jose` | 6.2.1 | JWE encryption for token cookies |
| `drizzle-orm` | ^0.45.1 | ORM for Neon Postgres |
| `@neondatabase/serverless` | ^1.0.2 | Serverless Postgres driver |
| `@anthropic-ai/sdk` | ^0.78.0 | AI event type classification |
| `after()` from `next/server` | (built-in) | Background tasks after response close |

Research below covers only the **new additions** needed for v1.1.

---

## v1.1 Feature → Stack Mapping

| Feature | New Stack Needed? | What |
|---------|------------------|------|
| Auto-sync via Vercel cron (all users) | Configuration only | `vercel.json` cron entry + `CRON_SECRET` env var — no new packages |
| Canvas deadline countdown UI | YES — date math | `date-fns@4.1.0` |
| Event deduplication dashboard | No new packages | React state + existing DB data from current API routes |
| Sync conflict resolution UI | No new packages | React 19 `useOptimistic` (built-in) + existing Drizzle queries |

---

## Recommended Stack (New Additions for v1.1)

### Core New Additions

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `date-fns` | 4.1.0 | Deadline countdown math (`intervalToDuration`, `formatDistanceToNow`, `isBefore`) | Zero-dependency, tree-shakeable, works in Server and Client Components. `intervalToDuration` returns `{ days, hours, minutes }` from two Date objects — exactly what a countdown display needs. Already the community standard for date math in React projects. No runtime beyond what is already in the bundle. |
| Vercel cron (config only) | N/A | Trigger `/api/cron/sync` daily for all users | Already researched for v1.0; adding cron entry to `vercel.json` is the only change. No new npm package. |
| React 19 `useOptimistic` | (built-in, React 19.2.3) | Optimistic state for conflict resolution decisions | Already installed. `useOptimistic` handles the "user picks keep-mine vs keep-theirs" flow with immediate UI feedback before the API round-trip completes. No library needed. |

### No New Libraries Required For

| Feature | Why No New Library |
|---------|-------------------|
| Deduplication dashboard UI | Drizzle queries already return `gcalCalendarId` + event metadata from existing tables. The dashboard is a Server Component that reads from DB and renders a diff-style list with Tailwind. No component library needed. |
| Conflict resolution modal | Native HTML `<dialog>` element + Tailwind classes handles the overlay. React 19 `useOptimistic` + Server Actions handles the mutation. No modal library (Radix, shadcn) needed for a single-use dialog in this app. |
| Countdown timer (client-side tick) | A `useEffect` with `setInterval(1000)` + `date-fns` `intervalToDuration` is 10 lines of code. No countdown timer library is warranted. |

---

## Auto-Sync: Vercel Cron Configuration Details

**No new npm package.** The only changes are:

1. Add a `"crons"` entry to `vercel.json` (already present in the project).
2. Add a `GET` export to a new `/api/cron/sync/route.ts` that:
   - Validates `Authorization: Bearer ${process.env.CRON_SECRET}` (Vercel injects this automatically)
   - Queries all users from Neon via Drizzle
   - Calls the existing sync logic from `gcalSync.ts` and `schoolMirror.ts` per user
   - Returns 200 to signal completion

**Critical constraints verified against Vercel docs (2026-03-16):**

- Hobby plan: cron runs at most once per day. Expressions triggering more frequently fail deployment with a hard error.
- Vercel injects timing drift of up to 59 minutes on Hobby (e.g., `0 8 * * *` fires anywhere from 08:00 to 08:59 UTC).
- Vercel does NOT retry failed cron invocations. The handler must catch and log errors internally.
- Cron endpoint receives `vercel-cron/1.0` as user-agent — useful for differentiating invocations in logs.
- With Fluid Compute enabled by default (April 2025): Hobby max function duration is **300s** — more than enough for iterating all users sequentially.
- Cron events can be delivered more than once (idempotency required). The existing dedup logic in `gcalSync.ts` already handles this via `hasChanged()` checks.

**vercel.json entry:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Route handler skeleton:**
```typescript
// app/api/cron/sync/route.ts
import type { NextRequest } from 'next/server';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // fetch all users with canvasIcsUrl set, run sync per user
}
```

**Multi-user iteration concern:** With a small user count (hobby-scale personal tool), sequential iteration is fine within 300s. If the user count grows to hundreds, the pattern should change to per-user fan-out (spawn a separate fetch call per user, run in parallel). Vercel docs recommend splitting cron jobs into smaller units if they approach the duration limit. Flag this in PITFALLS.

---

## Countdown UI: date-fns 4.1.0

**Install:** `npm install date-fns`

**Functions used:**

| Function | Purpose |
|----------|---------|
| `intervalToDuration(interval)` | Returns `{ years, months, days, hours, minutes, seconds }` between two dates |
| `isBefore(date, dateToCompare)` | Check if deadline has passed (render "overdue" state) |
| `formatDistanceToNow(date, { addSuffix: true })` | Human-readable "in 3 days" for less-urgent items |

**Client component pattern:**
```typescript
'use client';
import { intervalToDuration, isBefore } from 'date-fns';
import { useState, useEffect } from 'react';

// setInterval(1000) in useEffect for live countdown
// intervalToDuration({ start: now, end: deadline }) for display
```

**Important behavior note (verified):** In `date-fns@4.1.0`, `intervalToDuration` omits the `seconds` field when seconds equal zero. Code that destructures `{ days, hours, minutes, seconds }` must handle `seconds` being `undefined`. Use `?? 0`.

**Why not Luxon or Day.js:** `date-fns` is already the tree-shakeable standard. Luxon adds a Moment.js-style mutable object model (heavier). Day.js is similarly capable but has a plugin system for durations that requires additional imports. `date-fns` is the correct choice for a project that needs `intervalToDuration` and nothing else exotic.

**Why not native Intl.RelativeTimeFormat:** `Intl.RelativeTimeFormat` only formats a single unit ("3 days"). It cannot decompose a duration into `{ days, hours, minutes }` for a combined "2d 4h 30m" countdown display. `date-fns` `intervalToDuration` is needed for that.

---

## Deduplication Dashboard: No New Libraries

The deduplication dashboard shows which Canvas events are already synced vs. pending. The data source is:

- `courseTypeCalendars` table: has `gcalCalendarId` per `(userId, courseName, eventType)` — indicates a sub-calendar was created (sync has run at least once)
- `courseSelections.gcalCalendarId`: populated after first sync
- The sync engine already tracks `inserted` / `updated` / `skipped` counts in `SyncSummary`

**Implementation approach:**
- Server Component reads from DB via Drizzle (already wired)
- Client Component renders a two-column diff: "Already in Calendar" (events with GCal event IDs) vs "Will be added" (events parsed from ICS but not yet in GCal)
- Tailwind CSS v4 provides the diff-style row styling (green/gray badges)
- No new table needed for a simple dashboard — the existing `syncJobs` Map contains last-run summary data. A `syncHistory` DB table is optional but deferred.

---

## Conflict Resolution UI: React 19 Built-Ins Only

A "conflict" in this app is: Canvas ICS data for an event differs from what is currently in Google Calendar (e.g., title changed, date shifted). `gcalSync.ts` already has `hasChanged()` that detects this — currently it auto-updates. The UI change exposes these decisions to the user before committing.

**Stack additions needed: zero.**

React 19 (already installed) provides:

| Built-in | Role |
|----------|------|
| `useOptimistic` | Immediate UI feedback when user picks "keep mine" or "accept Canvas" before server confirms |
| Server Actions (native to Next.js App Router) | Mutation endpoint to persist conflict resolution decision in `eventOverrides` table |
| `useActionState` | Track pending/error state of the resolution action |

**Pattern:**
```typescript
// 'use client'
const [optimisticResolutions, addResolution] = useOptimistic(
  resolutions,
  (state, { uid, choice }) => state.map(r => r.uid === uid ? { ...r, choice } : r)
);
```

The modal is a native `<dialog>` element with `showModal()` / `close()`. One custom hook, no library. Tailwind handles the overlay styles.

---

## Installation

```bash
# Only one new dependency for v1.1
npm install date-fns
```

No new dev dependencies. Existing ts-jest config handles `date-fns` (it ships with ESM + CJS, CJS is used by ts-jest).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `date-fns@4.1.0` | `luxon@3.x` | When you need IANA timezone manipulation throughout the app, not just duration display. Overkill here — the countdown is local time only. |
| `date-fns@4.1.0` | `dayjs` with `duration` plugin | When bundle size is critical (Day.js is smaller). Negligible difference for this app since `date-fns` is tree-shaken. |
| Native `<dialog>` + Tailwind | `@radix-ui/react-dialog` or `shadcn/ui` | When you need a full accessible component system (focus trap, aria, portal). For a single conflict-resolution dialog in an internal tool, native `<dialog>` is sufficient and adds zero dependencies. |
| React 19 `useOptimistic` | SWR / TanStack Query | When you have a complex data-fetching layer with cache invalidation. This app uses Server Components + Server Actions — no client cache layer is needed. |
| Vercel Cron (no package) | `inngest` or `trigger.dev` | When you need per-user job queues, retries, sub-minute schedules, or fan-out orchestration. Daily sync of a personal-scale user list does not need this. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-countdown` or similar countdown npm packages | A `useEffect` + `date-fns` `intervalToDuration` is 10 lines. Adding a package for this is over-engineering for a single use case. | `date-fns` + `useEffect` |
| Radix UI / shadcn for the conflict modal | Adds ~15 kB of peer dependencies and significant install complexity for a feature that needs one `<dialog>` element. | Native `<dialog>` + Tailwind v4 |
| `inngest` or `trigger.dev` for cron | Both require external service accounts, webhook registration, and add dependencies. Vercel Cron is native, free, and sufficient for once-daily scheduling. | Vercel `vercel.json` cron entry |
| A `syncHistory` DB table (new) in this milestone | Adds schema migration work. The dedup dashboard can use existing `syncJobs` in-memory state for the current session and existing DB fields for persistent state. Defer a full history table to a future milestone. | Existing `courseTypeCalendars` + `courseSelections.gcalCalendarId` |
| `next-auth` in any version | Multi-account OAuth requirement still incompatible with NextAuth session model. See v1.0 STACK.md. | `arctic` + `jose` (already installed) |
| Cron expressions more frequent than `0 X * * *` on Hobby | Fails deployment with a hard error. | Once-daily expression only |

---

## Stack Patterns for v1.1

**Cron route handler (all users):**
- Query `users` table: `WHERE canvasIcsUrl IS NOT NULL`
- Iterate users, call shared sync function per user (same logic as manual sync)
- Catch and log per-user errors without aborting the loop — one user's bad token must not block others
- Return `200` with a JSON summary: `{ processed: N, errors: [] }`

**Countdown component (Client Component):**
- Props: `deadline: Date`, `label: string`
- State: `{ days, hours, minutes }` from `intervalToDuration`
- `useEffect`: `setInterval(60_000)` — minute-level precision is sufficient for a deadline countdown; 1-second ticks are unnecessary
- Render: color-coded badge — green if `>= 7 days`, yellow if `2–6 days`, red if `< 2 days`, strikethrough if `isBefore(deadline, now)`

**Dedup dashboard data flow:**
- Server Component fetches Canvas ICS events + queries `courseTypeCalendars` for which (course, type) pairs already have a GCal calendar
- Pass `{ synced: CourseEvent[], pending: CourseEvent[] }` as props to Client Component
- Client renders two-pane view with Tailwind

**Conflict resolution flow:**
1. Server Action `resolveConflict(uid: string, choice: 'keep-gcal' | 'accept-canvas')` writes to `eventOverrides` table
2. Client calls action via `useTransition` + `useOptimistic` for immediate visual update
3. Next manual or auto sync reads `eventOverrides` and respects the choice

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `date-fns@4.1.0` | Node.js 18+, React 19 | Ships CJS + ESM. ts-jest uses CJS path automatically. No transform config change needed. |
| `date-fns@4.1.0` | Next.js 16 App Router | Works in Server Components (pure TS), Client Components, and Route Handlers. No `'use client'` dependency. |
| `date-fns@4.1.0` | TypeScript 5 | Ships its own types. No `@types/date-fns` needed (not a separate package for v4). |
| React 19 `useOptimistic` | Next.js 16 App Router | Stable in React 19 (released Dec 2024). Already installed. |
| Vercel Cron | Next.js 16 Route Handlers | `GET` export required. No additional configuration in `next.config` needed. |

---

## Sources

- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — confirmed GET-based invocation, vercel.json config format (HIGH confidence)
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — confirmed CRON_SECRET pattern, Authorization Bearer header, Hobby ±59 min drift, no-retry behavior, idempotency requirement (HIGH confidence)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — confirmed Hobby maxDuration = 300s with Fluid Compute (HIGH confidence)
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — confirmed Hobby = once per day maximum, 100 cron jobs per project (HIGH confidence)
- [date-fns npm](https://www.npmjs.com/package/date-fns) — confirmed latest version 4.1.0 (HIGH confidence)
- [date-fns changelog](https://github.com/date-fns/date-fns/blob/main/CHANGELOG.md) — confirmed `intervalToDuration` omits `seconds: 0` in v4.1.0 (MEDIUM confidence — changelog referenced, behavior verified in issue tracker)
- [React 19 release blog](https://react.dev/blog/2024/12/05/react-19) — confirmed `useOptimistic` is stable in React 19 (HIGH confidence)
- [React useOptimistic docs](https://react.dev/reference/react/useOptimistic) — confirmed API signature and usage with Server Actions (HIGH confidence)

---

*Stack research for: v1.1 — auto-sync, countdown UI, dedup dashboard, conflict resolution*
*Researched: 2026-03-16*

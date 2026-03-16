# Project Research Summary

**Project:** Canvas-to-GCal v1.1 — Automation & Visibility
**Domain:** Calendar sync automation, student deadline tracking, background job orchestration on Vercel
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Canvas-to-GCal v1.1 adds four features to an already-working v1.0 app: daily auto-sync via Vercel cron, a deadline countdown panel, a deduplication preview dashboard, and a conflict resolution UI. The existing sync pipeline (`parseCanvasFeed` -> `filterEventsForSync` -> `syncCanvasEvents` + `mirrorSchoolCalendars`) is sound and is reused by all four new features — the v1.1 work is primarily a new cron entry point, two new DB tables (`syncLog`, `syncConflicts`), and three new UI panels. Only one new npm package is needed: `date-fns@4.1.0` for countdown date math. Everything else builds on libraries already installed (React 19, `googleapis`, Drizzle, Tailwind v4).

The recommended build order is strictly dependency-driven: `syncLog` table first (it unblocks both the cron endpoint and conflict detection and replaces `localStorage` as the authoritative last-sync source), then the cron route itself, then UI panels in order of complexity (CountdownPanel is pure client-side computation, DedupePanel adds a dry-run API call, ConflictPanel requires the full `syncConflicts` schema). This maps cleanly to three implementation phases: Phase 05 (syncLog + cron + countdown), Phase 06 (dedup dashboard), Phase 07 (conflict detection + resolution UI). The conflict resolution per-event decision UI should be explicitly scoped as v1.2 — it has the most schema and logic dependencies and gains nothing from being rushed.

The key risks cluster around the cron endpoint. Vercel Hobby cron has hard constraints (once/day max, no retry, up to 59-min timing jitter), Google Calendar API quota is shared across all users and can be exhausted without incremental `syncToken` sync, the existing in-memory `syncJobs` Map cannot be used for cron results, and the cron route must not call `getSession()` (no browser cookie in Vercel cron invocations). Every pitfall has a well-defined prevention — but each must be addressed before writing the user loop, not retrofitted after. A second distinct risk applies to the countdown panel: rendering time-remaining strings server-side causes React hydration errors for every non-UTC user; client-only rendering with `useEffect` is mandatory.

## Key Findings

### Recommended Stack

The v1.1 stack is minimal: one new package (`date-fns@4.1.0`), configuration-only for Vercel cron (`vercel.json` crons entry + `CRON_SECRET` env var), and built-in React 19 APIs (`useOptimistic`, `useActionState`) for the conflict resolution UI. No new authentication, no new ORM, no new UI component library, no new test framework.

**Core technologies:**
- `date-fns@4.1.0`: Deadline countdown math (`intervalToDuration`, `isBefore`, `formatDistanceToNow`) — the only new runtime dependency; `intervalToDuration` omits `seconds` when it equals zero in v4.1.0 (callers must use `?? 0`); ships CJS + ESM, works with ts-jest without config changes
- Vercel cron (config only): Daily all-user sync trigger — `vercel.json` crons block + `CRON_SECRET` header validation; Hobby plan maximum is once/day, 300s function duration with Fluid Compute; no npm package required
- React 19 `useOptimistic` (built-in): Optimistic conflict resolution UI — already installed and stable since React 19 (Dec 2024); no external state management library needed
- Native `<dialog>` + Tailwind v4 (built-in): Conflict resolution modal — zero new dependencies; Radix/shadcn adds 15 kB+ for a single internal dialog that does not need it

### Expected Features

**Must have (table stakes) — P1, v1.1 launch:**
- Auto-sync via Vercel cron (daily) with `last_synced_at` and `last_sync_status` written to DB — users cannot trust data they cannot verify is current; silent cron failure destroys trust
- Last-synced timestamp on dashboard (read from DB, not `localStorage`) — trust signal; must be migrated from `localStorage` so cron-triggered syncs update it
- Auto-sync opt-out toggle in settings — users expect control over background operations
- Deadline countdown grouped by urgency tier (Overdue / Due Today / Due This Week / Upcoming) — pure read on already-fetched ICS data; no new data model required
- Deduplication summary counts (N created / N updated / N skipped) — answers "what did this sync do?" without requiring per-event detail

**Should have (competitive differentiators) — P2, add after P1 is stable:**
- Conflict summary view — shows what Canvas changed since last sync; requires `syncConflicts` table
- Token expiry surfaced as actionable "Reconnect account" CTA rather than generic error message

**Defer to v1.2:**
- Per-event conflict resolution UI (keep Canvas / keep GCal) — requires event snapshot schema, GCal `updated` timestamp comparisons, and complex three-option decision UI; dependencies are too deep to rush
- Per-event deduplication drill-down — useful only after summary counts are trusted
- Sub-daily auto-sync (requires Vercel Pro plan upgrade or alternative scheduler)
- Email/push notifications for sync failures or approaching deadlines

**Anti-features to explicitly avoid:**
- Real-time sync — Canvas ICS is polling-only; no push mechanism exists on the Canvas side
- Bidirectional Canvas write-back — ICS is read-only; Canvas is always the authoritative source of truth
- Seconds-granularity countdown timer — minute-level ticks are sufficient; sub-minute updates are anxiety-inducing and waste client resources
- Permanent conflict audit log — unbounded DB growth; information becomes irrelevant after a sync decision

### Architecture Approach

Three structural additions layer onto the existing architecture without changing the sync pipeline: a new cron entry point (`/api/cron/sync`) that calls the existing sync logic without a user session, a `syncLog` DB table that replaces `localStorage` as the authoritative source for last-sync state, and three new UI panels (`CountdownPanel`, `DedupePanel`, `ConflictPanel`) added as collapsible sections inside the existing `SyncDashboard`. A new dry-run endpoint (`/api/sync/preview`) powers the dedup panel by running parse + diff without writing to GCal. A `syncConflicts` table stores conflicts detected when Canvas has changed an event that the user has also edited in GCal. The core sync pipeline (`gcalSync.ts`, `icalParser.ts`, `syncFilter.ts`) is unchanged.

**Major components:**
1. `/api/cron/sync` (NEW) — Vercel cron entry point; `CRON_SECRET` auth (never `getSession()`); queries all users with `canvasIcsUrl IS NOT NULL` from DB; calls existing sync logic per user inside per-user try/catch; writes `syncLog` row per user; must set `export const maxDuration = 300`
2. `syncLog` table (NEW) — One row per sync run (cron or manual); `(userId, startedAt DESC)` index; unblocks `lastSyncedAt` migration from `localStorage`; prerequisite for conflict detection
3. `CountdownPanel` (NEW) — Pure `'use client'` component; receives `courses[]` from `SyncDashboard` props with no extra API call; `useEffect` + `setInterval(60_000)` + `date-fns`; must not render server-side
4. `/api/sync/preview` (NEW) — Dry-run diff endpoint; runs same parse + filter as real sync; returns `{ toInsert, toUpdate, unchanged }`; loaded lazily on panel expand, not on dashboard mount
5. `DedupePanel` (NEW) — Client component; calls `/api/sync/preview` on panel expand; renders summary counts; backed by `syncedEvents` DB mirror for performance (no live GCal API on page load)
6. `syncConflicts` table (NEW) — Per-conflict rows with `canvasSnapshot` and `gcalSnapshot` as JSONB; requires `syncLog` to exist first; indexed on `(userId, resolvedAt) WHERE resolvedAt IS NULL`
7. `ConflictPanel` (NEW, P2/v1.2) — `useOptimistic` + Server Actions + native `<dialog>`; PATCH `/api/sync/conflicts/[id]` for resolution; deferred if Phase 07 becomes time-constrained

### Critical Pitfalls

1. **Cron route using `getSession()` or missing `CRON_SECRET` check** — Vercel cron invocations have no browser session cookie; `getSession()` always returns null; result is 401 on every cron run with no user notification. Prevention: `CRON_SECRET` header check as the first line of the cron handler, before any other logic.

2. **One user's token failure kills the entire cron loop** — `getFreshAccessToken()` returns null on failure; callers that throw on null propagate the error up and abort all remaining users in the loop. Prevention: wrap each user's sync in an independent try/catch; write per-user failure to DB; continue to the next user unconditionally.

3. **In-memory `syncJobs` Map used for cron results** — Cron runs in a separate serverless invocation; the Map is gone when the function exits; dashboard polling returns 404. Prevention: write cron results to DB (`lastSyncAt`, `lastSyncStatus` columns on `users` or `syncLog` table) before building the cron user loop.

4. **Deadline countdown rendered server-side causes React hydration errors** — Server renders "Due in 3 hours" in UTC; client hydrates in user's local timezone; strings differ for every non-UTC user. Prevention: countdown is a `'use client'` component; initialize all time-remaining state in `useEffect` only; render null/loading placeholder until mounted.

5. **Dedup dashboard reading live GCal API on every page load** — 20 `events.list` calls per user (5 courses x 4 types) takes 4-10 seconds and consumes quota on views, not syncs. Prevention: maintain a `syncedEvents` DB mirror table written at sync time; dashboard reads from DB only.

6. **Google Calendar per-project quota exhaustion during multi-user cron** — 10 users x ~70 GCal API calls = 700 calls per cron run; per-minute quota is breached without incremental sync. Prevention: implement `syncToken` incremental sync (returns only changed events, 90%+ call reduction after first run) before enabling multi-user cron; handle `410 Gone` by discarding the token and falling back to a full sync.

## Implications for Roadmap

The dependency graph from ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md converge on the same three-phase build order for v1.1.

### Phase 05: syncLog + Auto-Sync Cron + Countdown Panel

**Rationale:** `syncLog` is a prerequisite for conflict detection (Phase 07), for the cron endpoint to persist results, and for migrating `lastSyncedAt` out of `localStorage`. The cron endpoint is the headline v1.1 feature and has the most pitfall surface area — it should land in production early so behavior can be observed before UI is built on top of it. `CountdownPanel` is a pure client-side UI addition with zero new backend dependencies; it can be developed in parallel with the cron work and delivers immediate dashboard value.

**Delivers:** All users synced automatically daily; dashboard shows "Last synced X minutes ago" from DB (not `localStorage`); upcoming deadline list sorted by urgency tier on dashboard; cron failure surfaced as "Reconnect account" banner when token is expired.

**Features from FEATURES.md:** Auto-sync cron (P1), last-synced timestamp (P1), deadline countdown (P1), auto-sync opt-out toggle (P2).

**Pitfalls to avoid:**
- Set `export const maxDuration = 300` on cron route before writing any other logic
- `CRON_SECRET` auth check as first line; no `getSession()` call anywhere in cron handler
- Per-user try/catch in cron loop; DB write of per-user result (success or failure)
- Migrate `lastSyncedAt` from `localStorage` to `syncLog`; remove `localStorage` fallback
- `CountdownPanel` is client-only; no server-side time-remaining strings

**Stack used:** `date-fns@4.1.0` (new); `vercel.json` cron entry (config update); Drizzle schema migration for `syncLog` table.

---

### Phase 06: Deduplication Preview Dashboard

**Rationale:** The dedup panel requires `/api/sync/preview` (a read-only dry-run of the sync pipeline), which is medium complexity. It depends on Phase 05 (`syncLog` must exist; cron must be stable so "already synced" state is meaningful). Building after cron ensures the dedup preview reflects real ongoing sync activity, not just manual sync history.

**Delivers:** User sees "N new, N to update, N already synced" before or after manual sync; dedup panel loads in under 500ms via DB mirror regardless of course count.

**Features from FEATURES.md:** Deduplication preview summary counts (P1).

**Pitfalls to avoid:**
- `DedupePanel` loads lazily on panel expand, not on dashboard mount (prevents quota drain on every page view)
- Dedup state backed by `syncedEvents` DB mirror table written at sync time, not derived from live GCal API calls per page load
- Preview diff results are display-only; the real sync always re-fetches GCal state fresh at run time
- Include a `syncedAt` timestamp on the preview so stale previews are detectable

**Stack used:** Existing `googleapis` (read-only); Drizzle schema migration for `syncedEvents` table; React `useTransition` for lazy panel load.

---

### Phase 07: Conflict Detection and Resolution UI

**Rationale:** This is the highest-complexity feature. It requires `syncConflicts` DB table (depends on `syncLog` from Phase 05), changes to `gcalSync.ts` to detect conflicts at sync time, and a client-side decision UI. It must land after Phases 05 and 06 are stable. The recommended scope for Phase 07 is "detect and display conflicts" (write to `syncConflicts`, show in `ConflictPanel`); the full per-event keep/discard decision UI should be treated as v1.2 unless Phase 07 proves straightforward.

**Delivers:** Dashboard shows events where Canvas changed content since last sync AND user has edited the GCal copy; user can choose "keep Canvas" or "keep GCal" per conflict; decision persists across page reloads.

**Features from FEATURES.md:** Conflict resolution UI (P2 summary view; P3 per-event decision).

**Pitfalls to avoid:**
- `syncConflicts` table requires `syncLog` to exist first (conflict detection compares GCal `updated` to `lastSyncAt`)
- Conflict resolution decisions must be stored in DB (`syncConflicts.resolution` column); never re-derive from a one-time API call
- `useOptimistic` + Server Actions for immediate UI feedback before server confirms
- Clear label distinction between "already synced, no change" (DedupePanel) and "synced but Canvas changed it" (ConflictPanel) — users distinguish these immediately

**Stack used:** React 19 `useOptimistic` (built-in); native `<dialog>` + Tailwind; Drizzle schema migration for `syncConflicts` table; PATCH `/api/sync/conflicts/[id]` route.

---

### Phase Ordering Rationale

- **Phase 05 first:** `syncLog` is the foundational dependency for Phases 06 and 07; the cron endpoint is the milestone's headline feature and needs production observation time; `CountdownPanel` delivers visible user value at near-zero risk
- **Phase 06 second:** Dedup depends on cron being stable (the "already synced" state only matters once auto-sync is running); adds GCal read quota usage that must be scoped before conflict detection adds more
- **Phase 07 third:** Has the most schema and logic dependencies; building last means all prerequisites are in production and tested; scoping "detection + display" as Phase 07 and "per-event decision UI" as v1.2 is explicitly recommended
- The `syncToken` incremental sync mitigation for quota exhaustion must be implemented as part of Phase 05 (before the multi-user cron loop is written), not deferred to Phase 06

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 05 (cron — `syncToken` incremental sync):** Storage schema for per-subcalendar `nextSyncToken` (keyed by `(userId, calendarId)`) and `410 Gone` recovery flow need explicit implementation planning before writing the user loop. Well-documented in Google Calendar API official docs but non-trivial to wire.
- **Phase 07 (conflict detection — GCal `updated` timestamp semantics):** Needs verification that the GCal API's `updated` field reflects user edits vs. API-triggered patch operations. If `syncCanvasEvents` itself sets `updated` on every `events.patch` call, every synced event will appear as a conflict — a false-positive flood that would break the feature entirely.

Phases with standard patterns (can skip research-phase):
- **Phase 05 (CountdownPanel):** Established pattern — `useEffect` + `setInterval` + `date-fns` is straightforward; client-only hydration guard is documented in Next.js hydration error docs.
- **Phase 05 (syncLog schema):** Standard Drizzle migration; straightforward schema with no complex relations.
- **Phase 06 (DedupePanel):** Dry-run pattern is clearly scoped; `syncedEvents` mirror table approach is unambiguous; no novel integration needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against official Vercel docs, npm registry, React 19 release notes, and date-fns changelog. Only one new package. |
| Features | MEDIUM | UX patterns sourced from competitor products (Reclaim.ai, OneCal, StudentHub) and calendar sync articles. Canvas-to-GCal-specific priorities are well-reasoned but not user-validated. |
| Architecture | HIGH | Component boundaries, data flow, and build order derived from direct codebase inspection + official Vercel/Google docs. Dependency graph is explicit and traceable. |
| Pitfalls | HIGH | All critical pitfalls verified against official docs (Vercel, Google Calendar API, Next.js hydration). Direct codebase analysis confirms which gaps currently exist (no `lastSyncAt` column, no `syncedEvents` table, `syncJobs` Map limitation). |

**Overall confidence:** HIGH

### Gaps to Address

- **`syncToken` incremental sync implementation:** Identified as the mandatory mitigation for GCal quota exhaustion under multi-user cron, but the exact storage schema (per-subcalendar token keyed by `(userId, calendarId)`) and `410 Gone` recovery flow need a planning spike before Phase 05 coding begins. Flag for `/gsd:research-phase` on Phase 05.
- **GCal `updated` timestamp false-positive risk:** Conflict detection in Phase 07 depends on `updated` reflecting user edits. If `events.patch` in `syncCanvasEvents` itself sets `updated`, every event will appear as a conflict. Needs a targeted test before shipping Phase 07 conflict detection.
- **User count ceiling for sequential cron:** Sequential processing of ~50-60 users approaches the 300s function limit; the exact ceiling depends on per-user sync duration which varies by course count. Acceptable for the current personal-tool scale; document and revisit if user base grows.
- **DedupePanel vs. ConflictPanel UX boundary:** Research flags the risk of users confusing "already synced, no change" with "synced but Canvas changed it." Label and visual treatment should be validated before Phase 07 ships.

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — GET invocation, vercel.json config format
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — CRON_SECRET pattern, no-retry behavior, Hobby ±59 min drift, idempotency requirement
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — Hobby maxDuration = 300s with Fluid Compute
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby = once per day maximum, 100 cron jobs per project
- [React 19 release blog](https://react.dev/blog/2024/12/05/react-19) — `useOptimistic` stable in React 19
- [React useOptimistic docs](https://react.dev/reference/react/useOptimistic) — API signature with Server Actions
- [Next.js `after()` API Reference](https://nextjs.org/docs/app/api-reference/functions/after) — runs within route's `maxDuration`; does not extend deadline
- [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error) — date formatting causes server/client HTML mismatch
- [Google Calendar API: Manage Quotas](https://developers.google.com/workspace/calendar/api/guides/quota) — per-project and per-user-per-minute quota enforcement
- [Google Calendar API: Synchronize Resources Efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) — `syncToken` incremental sync, 410 Gone handling
- [Google Calendar API: Handle Errors](https://developers.google.com/workspace/calendar/api/guides/errors) — 429/403 quota errors, exponential backoff pattern
- [date-fns npm](https://www.npmjs.com/package/date-fns) — confirmed version 4.1.0
- Direct codebase inspection: `src/services/gcalSync.ts`, `src/app/api/sync/route.ts`, `src/lib/db/schema.ts`, `src/services/icalParser.ts`, `src/lib/tokens.ts`, `src/components/SyncDashboard.tsx`

### Secondary (MEDIUM confidence)
- [date-fns changelog](https://github.com/date-fns/date-fns/blob/main/CHANGELOG.md) — `intervalToDuration` omits `seconds: 0` in v4.1.0 (behavior verified in issue tracker)
- [Reclaim.ai — How Calendar Sync works](https://help.reclaim.ai/en/articles/3600762-overview-how-calendar-sync-works-and-what-s-for) — sync status states, event state handling patterns
- [StudentHub Canvas Assignment Tracker](https://www.student-hub.net/canvas-assignment-tracker) — urgency grouping: Overdue / Due Today / Due Tomorrow / Due This Week
- [CalendHub — Best Two-Way Calendar Sync Software 2025](https://calendhub.com/blog/best-two-way-calendar-sync-software-2025/) — UX gap: silent last-write-wins conflict handling
- [Sachith Dassanayake — Offline Sync & Conflict Resolution Patterns (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — side-by-side conflict comparison UI, timestamp context, simple resolution choices
- [Microsoft Outlook — Sync Conflict Resolution](https://support.microsoft.com/en-us/office/outlook-shows-conflict-errors-when-updating-or-cancelling-meetings-69c26227-40ef-4377-8f12-1749fcaad2ad) — "Keep This Item" vs. "Keep Server Version" decision UI pattern

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*

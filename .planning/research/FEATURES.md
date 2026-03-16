# Feature Research

**Domain:** Calendar sync automation & visibility — v1.1 additions to Canvas-to-GCal
**Researched:** 2026-03-16
**Confidence:** MEDIUM (UX patterns from calendar/productivity apps; Canvas-to-GCal-specific behavior inferred from existing codebase context)

---

## Scope Note

This file covers only the four v1.1 features being added to the existing v1.0 app. v1.0 features (OAuth, ICS parsing, course filtering, manual sync, school calendar mirror) are already built and are treated as stable dependencies here.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Last-synced timestamp visible on dashboard | Users need to know whether the data they see is current — every sync app (Reclaim.ai, OneCal, CalendarBridge) shows this | LOW | Already partially present from v1.0 sync status display; must persist in DB so auto-sync can update it without user interaction |
| Auto-sync success/failure indication | If cron ran overnight and failed, user discovers stale data — silent failure destroys trust | LOW | Show both "last synced at X" and "last sync status: OK / failed" on dashboard; write sync result to DB row per user |
| Opt-out / pause for auto-sync | Users expect control over background operations — OneDrive, Google Drive, Dropbox all provide pause/disable | LOW | Toggle in settings to disable auto-sync; do not force-sync users who have opted out |
| Overdue assignment highlight | Every student deadline tracker (StudentHub, Notion countdown templates, Canvas To-Do list) groups overdue items distinctly | LOW | Derived from ICS data already parsed; overdue = due_date < now(); no new data needed |
| "N days until" countdown for upcoming deadlines | Users of Notion countdown templates and study timer apps consistently want "days remaining" not just raw date | LOW | Simple date math on existing parsed events; surface on dashboard below sync status |

### Differentiators (Competitive Advantage)

Features that set this product apart from generic calendar sync tools that lack Canvas awareness.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deadline countdown grouped by urgency tier | StudentHub organizes as overdue / today / tomorrow / this week — this Canvas-aware app can add course and type context (e.g., "CS 101 Assignment due in 2 days") | MEDIUM | Requires course name + event type already available in DB; UI renders grouped list; no new data fetch |
| Deduplication preview before manual sync | Show user "12 new, 3 updated, 5 already synced" before committing changes; Apple Calendar iOS 26 introduced sync preview as a standard pattern | MEDIUM | Dry-run mode on existing `gcalSync.ts`; compute diff between parsed ICS events and existing GCal events; do not write — only return counts |
| Conflict detail view (what changed in Canvas vs. what's in GCal) | Most calendar sync tools silently apply last-write-wins with no notification (CalendHub identified this as a UX gap in the market); surfacing changes builds trust | HIGH | Requires storing the last-synced state of each event to compare against new ICS data; new DB table or extra columns on existing events table |
| Per-event conflict decision (keep Canvas / keep GCal / merge) | Outlook-style conflict dialog offers "Keep This Item" vs. "Keep Server Version"; users who manually edited GCal events expect their edits to be preserved | HIGH | Three-way UI decision; complex because Canvas is always source-of-truth in this app's one-way model; see Anti-Features below for scope limit |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time sync / push on Canvas change | "Sync immediately when Canvas updates" — sounds like an obvious improvement | Canvas ICS is a polling-only feed; no push mechanism exists; Vercel Hobby cron is limited to once/day minimum; adding webhooks would require a persistent server | Daily auto-sync is sufficient for academic deadlines; manual "Sync Now" covers urgent cases |
| Full bidirectional conflict resolution (user edits GCal, it pushes back to Canvas) | "I want to correct assignment details" | Canvas is the authoritative source; writing back to Canvas via ICS is not possible (ICS is read-only); Canvas API write access would require Canvas OAuth, a separate auth flow, and institutional permission | One-way model: Canvas always wins on factual fields (title, due date); GCal edits to synced events are overwritten on next sync by design |
| Per-event conflict UI for every changed field | "Show me exactly what changed in each field" | If Canvas updates 40 assignments at semester start (syllabus revision), user must click through 40 conflict dialogs — high friction, low value | Show a summary count ("8 events have changed titles in Canvas"); only prompt for conflicts that involve GCal user edits vs. Canvas changes, which requires tracking GCal modification timestamps |
| Hourly auto-sync on Vercel Hobby | More frequent sync = fresher data | Vercel Hobby plan cron minimum interval is once/day; attempting sub-daily cron is a billing/plan constraint, not a code constraint | Daily cron + manual "Sync Now" button satisfies the use case; document this clearly in settings UI |
| Countdown timer with real-time seconds/minutes update | "Show me exactly how many hours and minutes left" | React re-render on interval wastes client resources; academic deadlines are 24h-scale events; sub-hour granularity is anxiety-inducing not helpful | Show days remaining for events more than 1 day out; show "Due today" / "Due in X hours" only for same-day items; update on page load, not on interval |
| Sync conflict log as permanent audit trail | "Show me every conflict that's ever occurred" | Unbounded DB growth; users don't read audit logs; the information becomes irrelevant after a sync decision | Show only the current sync run's summary; clear conflicts on next successful sync |

---

## Feature Dependencies

```
[Auto-sync cron]
    └──requires──> [Per-user sync preferences stored in DB]  (already exists — v1.0)
    └──requires──> [OAuth tokens stored in DB]               (already exists — v1.0)
    └──requires──> [Sync result written to DB per user]      (new: last_synced_at, last_sync_status columns)
    └──enables──>  [Last-synced timestamp on dashboard]

[Deadline countdown UI]
    └──requires──> [ICS events parsed and stored]            (already exists — v1.0 icalParser.ts)
    └──requires──> [Course + event type data in DB]          (already exists — v1.0 schema)
    └──enhances──> [Auto-sync cron]                          (countdown freshness depends on sync running)

[Deduplication dashboard]
    └──requires──> [gcalSync.ts dedup logic]                 (already exists — v1.0)
    └──requires──> [Dry-run mode on sync pipeline]           (new: flag to compute diff without writing)
    └──enhances──> [Auto-sync cron]                          (preview useful before first cron run)
    └──conflicts──> [Conflict resolution UI]                 (both show event-level diffs; risk of UI overlap)

[Conflict resolution UI]
    └──requires──> [Last-synced event state stored in DB]    (new: snapshot of event fields at last sync)
    └──requires──> [GCal event modification timestamp]       (available via Google Calendar API updatedTime field)
    └──requires──> [Deduplication dashboard]                 (conflicts are a subset of "already synced" events that have diverged)
    └──conflicts──> [One-way sync model]                     (user decisions must still respect Canvas-as-source-of-truth)
```

### Dependency Notes

- **Auto-sync requires a DB write of sync results.** The cron endpoint cannot update the dashboard without writing `last_synced_at` and `last_sync_status` back to the users table (or a sync_runs table). This is the most critical new schema change.
- **Deadline countdown is a pure read.** No new data required — ICS events are already in the system. The only work is the dashboard UI component and sorting/grouping logic.
- **Deduplication dashboard is a dry-run, not a new data source.** The existing `gcalSync.ts` diff logic runs without committing writes; the result is a count summary. The complexity is making the pipeline return a preview object instead of always executing.
- **Conflict resolution UI has the highest complexity and the most risk of scope creep.** It requires storing event state snapshots (new schema), fetching GCal `updatedTime` fields (new API call), and presenting a decision UI. Consider scoping to "show what changed" without requiring a per-event decision.
- **Deduplication and conflict resolution must be clearly separated in the UI.** "Already synced, no change" (dedup) and "synced but Canvas changed it since" (conflict) are different states that users distinguish immediately once they see them labeled incorrectly.

---

## MVP Definition

### This Milestone: v1.1 — Launch With

Minimum needed to deliver the stated milestone goals.

- [ ] **Auto-sync via Vercel cron (daily)** — cron endpoint calls sync pipeline for all active users; writes `last_synced_at` + `last_sync_status` per user; dashboard shows these fields
- [ ] **Deadline countdown on dashboard** — sorted list of upcoming Canvas deadlines grouped as: Overdue / Due Today / Due This Week / Upcoming; shows course name, event type, days remaining; updates on page load
- [ ] **Deduplication preview (summary counts)** — before or after manual sync, show "N created / N updated / N skipped" breakdown; skipped events are the "already synced" bucket; no per-event listing required for MVP

### Defer to v1.2 (Add After Validation)

- [ ] **Conflict resolution UI (full)** — surface events where Canvas data changed since last sync AND user has edited the GCal copy; offer keep-Canvas / keep-GCal decision; defer because it requires new schema (event snapshots), new API calls, and a complex UI that depends on the rest of v1.1 being stable
- [ ] **Per-event deduplication drill-down** — expand the summary counts into a list of individual events; useful but not necessary once the counts are trusted

### Future (v2+)

- [ ] Sub-daily auto-sync (requires Vercel Pro plan upgrade or alternative scheduler)
- [ ] Email / push notification when sync fails or high-priority deadline approaches
- [ ] Conflict history / audit log

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auto-sync cron (daily) | HIGH — eliminates manual sync burden | MEDIUM — cron endpoint + DB write per user | P1 |
| Last-synced timestamp on dashboard | HIGH — trust signal for auto-sync | LOW — read from DB, already partially exists | P1 |
| Deadline countdown (grouped by urgency) | HIGH — core dashboard value, no new data needed | LOW — date math + UI component | P1 |
| Deduplication preview (summary counts) | MEDIUM — answers "what will this sync do?" | MEDIUM — dry-run mode on existing pipeline | P1 |
| Opt-out toggle for auto-sync | MEDIUM — user control expectation | LOW — one DB boolean, settings UI | P2 |
| Conflict resolution UI (summary view) | MEDIUM — shows what Canvas changed since last sync | HIGH — requires event snapshot schema | P2 |
| Conflict resolution UI (per-event decision) | LOW — most users trust Canvas as source-of-truth | HIGH — complex UI + API + schema | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add if P1 is stable
- P3: Nice to have, v1.2 or later

---

## Competitor Feature Analysis

| Feature | Reclaim.ai | OneCal | StudentHub | Our Approach |
|---------|------------|--------|------------|--------------|
| Background auto-sync | Yes (real-time, paid) | Yes (real-time, paid) | Yes (via Canvas API) | Daily cron (Vercel Hobby constraint); manual override always available |
| Sync status display | Last sync shown in planner | Not surfaced prominently | N/A | `last_synced_at` + status badge on dashboard |
| Dedup / "already synced" UI | Opaque synced events shown with reduced opacity in planner | Hide source calendar to avoid visual duplication | N/A | Show counts (created / updated / skipped) before and after sync |
| Conflict resolution | Silent last-write-wins; no user prompt | Silent last-write-wins | N/A | Summary of what changed in Canvas since last sync; full per-event decision deferred |
| Deadline countdown | Not offered (sync tool, not task manager) | Not offered | Overdue / today / tomorrow / this week grouping | Same urgency tiers as StudentHub, but Canvas-aware (course + event type labels) |
| Pause / disable sync | Yes (per-sync policy) | Yes | N/A | Toggle in settings to disable auto-sync |

**Key competitive insight:** No calendar sync tool combines all-in-one Canvas deadline awareness with the dedup preview and conflict summary that v1.1 adds. Reclaim/OneCal handle the sync reliably but are generic; StudentHub handles the deadline view but is read-only (no calendar write). This milestone closes the gap between "I can see my deadlines" and "my calendar stays current automatically."

---

## Sources

- [Reclaim.ai — How to handle duplicate events from Calendar Sync](https://help.reclaim.ai/en/articles/3639940-how-to-handle-duplicate-events-from-calendar-sync) — Dedup UI pattern: opaque events, hide-source-calendar approach
- [Reclaim.ai — How Calendar Sync works](https://help.reclaim.ai/en/articles/3600762-overview-how-calendar-sync-works-and-what-it-s-for) — Sync overview and event state handling
- [Google Open Health Stack — Offline & Sync Design Guidelines](https://developers.google.com/open-health-stack/design/offline-sync-guideline) — Sync status states: Queued / Syncing / Synced / Failed; timestamp display guidance; "last updated" patterns
- [StudentHub Canvas Assignment Tracker](https://www.student-hub.net/canvas-assignment-tracker) — Urgency grouping: Overdue / Due Today / Due Tomorrow / Due This Week; colored dot calendar
- [Notion Countdown Formula for Deadlines](https://noteapiconnector.com/notion-countdown-formula) — Days-remaining display: positive = future, 0 = today, negative = overdue; days/hours/minutes granularity guidance
- [TIMIFY — Google Calendar Sync Conflict Types](https://www.timify.com/en/support/4028436-the-google-calendar-sync-app-conflict-types-to-watch-out-for/) — Dedicated "Sync Conflicts" tab; scheduling vs. working-time conflict types; "delete or move one" resolution UI
- [CalendHub — Best Two-Way Calendar Sync Software 2025](https://calendhub.com/blog/best-two-way-calendar-sync-software-2025/) — Identified UX gap: most tools apply last-write-wins silently; CalendHub differentiates by notifying which version was preserved
- [Sachith Dassanayake — Offline Sync & Conflict Resolution Patterns (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — Side-by-side comparison of conflicting versions; timestamp context; simple action choices (keep local / use server / merge)
- [Microsoft Outlook — Sync Conflict Resolution](https://support.microsoft.com/en-us/office/outlook-shows-conflict-errors-when-updating-or-cancelling-meetings-69c26227-40ef-4377-8f12-1749fcaad2ad) — "Keep This Item" vs. "Keep Server Version" decision UI pattern
- [Chrome for Developers — Periodic Background Sync API](https://developer.chrome.com/docs/capabilities/periodic-background-sync) — Background sync UX expectations: no user prompt needed; restrictions on registration frequency
- [OneCal — Calendar Sync](https://www.onecal.io/) — Conflict avoidance via automatic block-busy; no user decision required in simple cases

---

*Feature research for: Canvas-to-GCal v1.1 — Automation & Visibility milestone*
*Researched: 2026-03-16*

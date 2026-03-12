# Feature Research

**Domain:** Calendar sync / aggregation app (Canvas ICS + Google Calendar mirror)
**Researched:** 2026-03-11
**Confidence:** MEDIUM-HIGH (ecosystem well-understood; Canvas-specific patterns from official docs + community)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google OAuth (both accounts) | Every modern Google-integrated app uses OAuth — manual token paste is a red flag | MEDIUM | Requires Google Cloud project, redirect URIs, token storage; school + personal = two separate OAuth grants in one session |
| Persistent token storage | Users expect to stay connected; re-pasting tokens on every visit is unacceptable | MEDIUM | Needs server-side session or encrypted cookie storage; stateless app must become stateful here |
| Canvas ICS feed URL input | Core entry point for Canvas data — already partially exists | LOW | Already built; needs polish and validation feedback |
| Course-level filtering (select which courses sync) | Users have many Canvas courses; they don't want all of them | MEDIUM | Checkbox list of parsed courses; persisted per user |
| Push Canvas events to Google Calendar | The primary value delivery — without this there is no product | MEDIUM | Already partially exists in `gcalSync.ts`; needs OAuth token plumbing |
| Deduplication on re-sync | Users will sync multiple times; duplicate events destroy trust | MEDIUM | Already in `gcalSync.ts`; must use stable IDs derived from ICS UID |
| Manual "Sync Now" trigger | Users want control — to force a refresh immediately | LOW | Button that calls sync pipeline; needs visible loading state |
| Sync status / last synced timestamp | Users need confirmation that sync ran and when | LOW | Simple timestamp displayed in UI; critical for trust |
| Basic error feedback | If OAuth fails, feed is invalid, or API quota is hit — user must know why | MEDIUM | Clear error messages, not silent failures |
| School Google Calendar mirror (one-way) | Core stated requirement — school → personal is the second half of the value prop | HIGH | Requires school OAuth scope for calendar read; create copies in personal calendar |

### Differentiators (Competitive Advantage)

Features that set this product apart from generic tools like CalendarBridge or SyncGene.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Event-level filtering within a course | Students want to sync assignments but not office-hours events, or vice versa | HIGH | Requires expanding the course tree into individual event types; significant UI complexity |
| Automatic scheduled sync (periodic) | "Set and forget" — users don't want to manually trigger sync each time | MEDIUM | Cron job or Vercel Cron; every 1-6 hours is the sweet spot; must be idempotent |
| Canvas course color mapping to GCal calendar colors | Visual continuity — each course gets a distinct color matching Canvas | LOW | Colors available in Canvas ICS `X-APPLE-CALENDAR-COLOR` extension or assignable by course |
| Event title/description control | Choose whether to include assignment descriptions, point values, etc. in synced events | LOW | Filtering on ICS fields during transformation; low effort, noticeable UX win |
| Selective calendar mirroring (choose which school calendars) | School accounts often have many calendars; students only care about class-related ones | MEDIUM | Requires listing school Google calendars via API and letting user pick |
| Sync conflict reporting | Show which events were skipped or updated on last sync run | MEDIUM | Sync run summary: X created, Y updated, Z skipped |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create real problems for this project's scope and constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Two-way / bidirectional sync | "Sync everything both directions" sounds complete | School accounts often have IT-managed write restrictions; creates infinite update loops; personal event changes leaking into school account is unexpected behavior; already explicitly out of scope | Keep one-way (school → personal, Canvas → personal) and make it reliable |
| Real-time push sync (webhooks) | "Sync immediately when Canvas updates" sounds great | Canvas ICS is a pull-only feed with no push mechanism; Google Calendar webhooks require persistent server + public URL management; adds major operational complexity for marginal gain over hourly polling | Scheduled polling every 1-6 hours is adequate for academic deadlines |
| Native mobile app | Students use phones | Out of scope; adds separate codebase, app store submissions, review cycles | Responsive web design + PWA installability (add to home screen) covers 90% of mobile use |
| Outlook / Apple Calendar targets | "I don't use Google Calendar" | Adds OAuth flows and API clients for each provider; multiplicative complexity with no payoff for the stated use case | Hard-scope to Google Calendar; document clearly in onboarding |
| AI-powered scheduling suggestions | Calendar sync tools are adding AI assistants | Completely orthogonal to the core problem; adds LLM API costs, latency, and scope | Do one thing well: reliable, accurate sync |
| Shared / team calendars | "My study group wants to see this" | Introduces multi-tenancy, permissions, and privacy concerns | App is explicitly personal-use; document this |
| Manual event editing within the app | "Let me edit the event here too" | Creates its own source-of-truth that conflicts with Canvas as the source; dedup logic breaks | Direct users to edit in Canvas or Google Calendar; the sync app is a one-way pipe |

---

## Feature Dependencies

```
[Google OAuth — school account]
    └──required by──> [School Google Calendar mirror]
    └──required by──> [Selective calendar mirroring]

[Google OAuth — personal account]
    └──required by──> [Push Canvas events to Google Calendar]
    └──required by──> [School Google Calendar mirror]
    └──required by──> [Persistent token storage]

[Persistent token storage]
    └──required by──> [Automatic scheduled sync]
    └──required by──> [Sync status / last synced timestamp]

[Canvas ICS feed URL input]
    └──required by──> [Course-level filtering]
    └──required by──> [Push Canvas events to Google Calendar]

[Course-level filtering]
    └──enhances──> [Push Canvas events to Google Calendar]
    └──prerequisite for──> [Event-level filtering within a course]

[Push Canvas events to Google Calendar]
    └──enhances──> [Sync conflict reporting]

[School Google Calendar mirror]
    └──enhances──> [Selective calendar mirroring]
    └──enhances──> [Sync conflict reporting]

[Manual "Sync Now" trigger]
    └──enhances──> [Automatic scheduled sync]  (manual overrides the schedule)

[Automatic scheduled sync] ──conflicts──> [Stateless app architecture]
```

### Dependency Notes

- **Both OAuth grants are required before any sync can run.** The onboarding flow must collect school + personal Google credentials before showing filtering UI or running sync.
- **Persistent token storage is a prerequisite for scheduled sync.** Without a stored token, there is no way to run sync on a schedule — the user is not present to re-auth.
- **Course-level filtering must come before event-level filtering.** You need the course list before you can drill into individual event types. Build the tree top-down.
- **Automatic scheduled sync conflicts with the current stateless architecture.** The app must gain some persistent state (at minimum: OAuth tokens + sync preferences) before a scheduler can function. This is the single biggest architectural prerequisite for the milestone.
- **Manual sync trigger and scheduled sync are complementary, not competing.** Both call the same sync pipeline; the trigger source (user click vs. cron) is the only difference.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to deliver the core value.

- [ ] Google OAuth flow for two accounts (school + personal) — without this, nothing works
- [ ] Persistent token storage (server-side session or encrypted DB) — required for tokens to survive page navigation
- [ ] Course-level filtering UI (checkbox list) — users must be able to exclude irrelevant courses
- [ ] Push selected Canvas assignments to personal Google Calendar — core value delivery
- [ ] School Google Calendar mirror to personal (one-way, all calendars) — second half of core value
- [ ] Manual "Sync Now" button with loading state — user control and feedback
- [ ] Sync status display (last synced timestamp + event counts) — trust signal
- [ ] Basic error states (auth failure, bad ICS URL, API quota) — prevents silent failures

### Add After Validation (v1.x)

Features to add once core sync is working and trusted.

- [ ] Automatic scheduled sync (hourly/daily cron) — convenience upgrade once manual sync is proven reliable
- [ ] Selective school calendar mirroring (choose which school calendars) — reduces noise once mirroring works
- [ ] Canvas course color mapping to GCal — polish, low effort after core works
- [ ] Sync run summary (X created, Y updated, Z skipped) — useful once users have run several syncs

### Future Consideration (v2+)

Features to defer until there is evidence of demand.

- [ ] Event-level filtering within a course — high complexity; validate that course-level filtering is insufficient first
- [ ] Event title/description field control — low priority; most students want full details
- [ ] PWA / add-to-home-screen — useful only after core reliability is established

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth (both accounts) | HIGH | MEDIUM | P1 |
| Persistent token storage | HIGH | MEDIUM | P1 |
| Course-level filtering UI | HIGH | MEDIUM | P1 |
| Push Canvas events to GCal | HIGH | LOW (mostly exists) | P1 |
| School GCal mirror (one-way) | HIGH | MEDIUM | P1 |
| Manual sync trigger | HIGH | LOW | P1 |
| Sync status / last synced | MEDIUM | LOW | P1 |
| Basic error feedback | HIGH | LOW | P1 |
| Automatic scheduled sync | HIGH | MEDIUM | P2 |
| Selective calendar mirroring | MEDIUM | MEDIUM | P2 |
| Sync run summary | MEDIUM | LOW | P2 |
| Canvas color mapping | LOW | LOW | P2 |
| Event-level filtering | MEDIUM | HIGH | P3 |
| Event field control | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | CalendarBridge | SyncGene | OneCal | Our Approach |
|---------|---------------|----------|--------|--------------|
| Multi-account Google sync | Yes (up to 8) | Yes (limited sources) | Yes | Two-account (school + personal) — fixed topology, not general-purpose |
| One-way sync option | Yes | Yes | Yes | One-way only (intentional) |
| Event filtering / selection | Yes (expanded 2025) | No | Partial | Course-level + event-type level; Canvas-aware grouping |
| Sync frequency | Real-time | Near-real-time | Real-time | Hourly scheduled + manual trigger (ICS pull = polling only) |
| LMS / ICS feed support | No | No | No | Core differentiator — Canvas ICS parsing is built-in |
| Setup complexity | 3-step OAuth | Multi-step | Simple | 2-step OAuth + paste ICS URL; aim for < 5 min to first sync |
| Privacy / "busy block" mode | Yes | No | Yes | Not needed — personal calendar, all details visible |
| Pricing | $4+/month | $12.50+/month | Paid | Free (self-hosted or Vercel free tier) |

**Key competitive insight:** No existing general-purpose calendar sync tool understands Canvas ICS structure (courses, assignment types). That LMS-awareness — grouping events by course, filtering by assignment type — is the unique value this app delivers that CalendarBridge/SyncGene cannot.

---

## Sources

- [CalendarBridge: How to Sync Two Google Calendars](https://calendarbridge.com/blog/how-to-sync-two-google-calendars/) — CalendarBridge feature set, OAuth flow, filtering options
- [CalendarBridge vs SyncGene Comparison 2025](https://slashdot.org/software/comparison/CalendarBridge-vs-SyncGene/) — Competitor feature comparison
- [Top Calendar Synchronization Apps 2025 — calendarsync.com](https://www.calendarsync.com/blog/calendar-synchronization-apps) — Essential vs premium features, user priorities
- [How to Sync Multiple Google Calendars 2025 — CalendHub](https://calendhub.com/blog/methods-sync-multiple-google-calendars-2025) — Multi-account sync methods
- [CalendarBridge 2026 Review — meetergo](https://meetergo.com/en/magazine/calendarbridge) — Current feature set
- [Canvas ICS Feed — Instructure Community](https://community.canvaslms.com/t5/Student-Guide/How-do-I-view-the-Calendar-iCal-feed-to-subscribe-to-an-external/ta-p/331) — Canvas ICS feed capabilities and limitations
- [Google OAuth 2.0 Best Practices — Google Developers](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — OAuth UX guidelines
- [Mirror Calendar Feature — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/4690658/calendar-mirroring) — One-way mirror user expectations
- [Implement Bidirectional Calendar Sync 2025 — CalendHub](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) — Sync status tracking patterns, timestamp fields
- [Handle API Errors — Google Calendar API](https://developers.google.com/workspace/calendar/api/guides/errors) — Error handling patterns for GCal integration
- [15 Filter UI Patterns That Actually Work 2025 — Bricxlabs](https://bricxlabs.com/blogs/universal-search-and-filters-ui) — Checkbox filter UX patterns

---

*Feature research for: Canvas-to-Google-Calendar sync app*
*Researched: 2026-03-11*

# Phase 2: Sync Pipeline - Research

**Researched:** 2026-03-12
**Domain:** Google Calendar API (sub-calendars, events, colors), ICS parsing, Drizzle ORM schema extension, AI title cleanup (Anthropic SDK), React accordion UI
**Confidence:** HIGH (core stack verified against existing codebase and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Course & event selection UI**
- Accordion layout: each course is a collapsible section with a course-level checkbox
- Course-level checkbox selects/deselects all events in that course
- Expanded events show: title + due date + truncated description preview
- Selections persist in DB per user across sessions
- New Canvas events auto-included unless their course is disabled — no opt-in required for new events

**Event title cleanup**
- AI auto-formats Canvas event titles on import (strip redundant course tags, trim boilerplate)
- User can also manually click to rename any event title
- Only the cleaned/renamed version is displayed — original stored internally for dedup
- School calendar events are NOT cleaned — kept as-is from the institution

**Color assignment**
- Auto-assign a distinct Google Calendar color to each course on first import
- Inline color dot on each course row in the accordion header — click to open dropdown of Google's 11 colors
- User can override any auto-assigned color
- Color choices persist in DB per user across sessions
- No overflow handling needed — user will never have more than 11 courses

**School calendar mirroring**
- Fetch all calendars from linked school Google account, display as a checkbox list
- User selects which school calendars to mirror (not forced to mirror all)
- Selections persist in DB
- If no school account linked, hide the school calendars section entirely — no empty state

**Calendar organization in Google Calendar**
- Create separate Google sub-calendars on the personal account per source
- One sub-calendar per Canvas course (e.g., "Canvas - Intro to CS")
- One sub-calendar per mirrored school calendar (e.g., "School - Class Schedule")
- User can toggle visibility of each independently in Google Calendar's sidebar

**Dashboard layout**
- Single scrollable page with stacked sections: Canvas courses on top, school calendars below
- Sticky "Sync Now" button fixed at bottom of viewport — always accessible
- Progress bar with event counts during sync ("Syncing... 12/35 events")
- Post-sync summary shows created/updated/skipped counts
- Summary persists until user makes a change or syncs again — no auto-dismiss

### Claude's Discretion
- Exact accordion expand/collapse animation
- AI title formatting prompt/logic details
- Progress bar styling and animation
- DB schema design for selections, colors, and sync state tables
- How to handle the existing `CONCURRENCY = 3` bottleneck (batch API vs other approach)
- Sub-calendar naming conventions and color inheritance

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANVAS-01 | User can paste Canvas ICS feed URL and see parsed courses | `icalParser.ts` already parses + groups by course; API route needs refactor to use stored `canvasIcsUrl` from DB instead of request body |
| CANVAS-02 | User can select/deselect entire courses to include or exclude | New `courseSelections` DB table; accordion UI with course-level checkbox |
| CANVAS-03 | User can select/deselect individual events within a course | New `eventSelections` DB table or per-event override column; event rows with checkboxes inside accordion |
| CANVAS-04 | Selected Canvas events push to personal Google Calendar with dedup | `gcalSync.ts` already handles dedup via `extendedProperties.private.canvasCanvasUid`; refactor to target course sub-calendars instead of 'primary' |
| CANVAS-05 | Each course's events get a distinct Google Calendar color | New `courseColors` DB table; Google Calendar API has 11 event colorIds (1-11); sub-calendars created per course |
| MIRROR-01 | School Google Calendar events mirror one-way to personal account | `calendar.calendarList.list` on school account; `calendar.calendars.insert` on personal account to create sub-calendars; `calendar.events.list` + `events.insert` for mirroring |
| MIRROR-02 | User can choose which school calendars to mirror | New `schoolCalendarSelections` DB table; checkbox list UI below Canvas section |
| SYNC-01 | User can trigger sync manually via "Sync Now" button | Sticky button at bottom of dashboard; POST to `/api/sync` route; streaming or polling for progress bar |
</phase_requirements>

---

## Summary

Phase 2 builds on a solid Phase 1 foundation. The core parsing and sync utilities (`icalParser.ts`, `gcalSync.ts`) already exist and work; the primary work is: (1) adding three or four new Drizzle schema tables for persistence of user selections, colors, and sub-calendar IDs; (2) building the accordion selection UI in React with `useState` (no global state manager needed); (3) refactoring the two existing API routes to use session-based auth and stored DB values rather than request-body params; (4) adding Google Calendar sub-calendar creation per course and per mirrored school calendar; (5) adding AI title cleanup via `@anthropic-ai/sdk`; and (6) wiring the "Sync Now" button to a new unified `/api/sync` route that returns streaming progress.

The biggest architectural risk is the existing `CONCURRENCY = 3` concurrency pattern in `gcalSync.ts`. For a typical semester (35-80 Canvas events), it will work acceptably for manual sync. However, each event requires two Google API calls (a `events.list` check + `events.insert` or `events.update`), so 50 events = 100 API calls. This must be replaced with a batch-friendly approach — either use the Google Calendar Batch API (up to 1000 calls per request, multipart/mixed format) or restructure to bulk-check with `extendedProperties` filter and then batch-insert only new events. The batch approach is recommended for correctness and scalability.

The school calendar mirroring adds two new Google Calendar API surfaces that don't exist yet: `calendar.calendarList.list` on the school account OAuth client, and `calendar.calendars.insert` on the personal account OAuth client to create sub-calendars.

**Primary recommendation:** Refactor `gcalSync.ts` to use per-course sub-calendars (not 'primary'), replace per-event `events.list` dedup checks with a single `events.list?privateExtendedProperty=canvasSourceCalendarId=X` bulk fetch, then batch-insert/update from the diff.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | ^171.4.0 | Google Calendar API — sub-calendar create, event CRUD, calendarList | Already installed; official Google client |
| drizzle-orm | ^0.45.1 | ORM for new schema tables | Already installed; Neon-native |
| drizzle-kit | ^0.31.9 | Schema push to Neon | Already installed; `npx drizzle-kit push` |
| node-ical | ^0.25.5 | ICS feed parsing | Already installed; proven in Phase 1 |
| @anthropic-ai/sdk | latest | AI event title cleanup | Standard Anthropic SDK; `npm install @anthropic-ai/sdk` |
| react | 19.2.3 | Accordion UI, checkbox state, progress bar | Already installed |
| next | 16.1.6 | App Router, API routes, Server Components | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | latest | `messages.create` for title cleanup on import | Needed for CONTEXT.md locked decision on AI title formatting |

**No new UI libraries are needed.** The existing glassmorphic design system (CSS variables, Tailwind v4) covers all accordion, checkbox, color picker, and progress bar UI requirements.

**Installation (only new dependency):**
```bash
npm install @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure

New files needed in Phase 2:

```
src/
├── app/
│   ├── api/
│   │   ├── parse-ics/route.ts          # REFACTOR: use stored canvasIcsUrl from DB
│   │   ├── sync-gcal/route.ts          # REFACTOR: session auth, use sub-calendars
│   │   ├── sync/route.ts               # NEW: unified sync endpoint with streaming progress
│   │   ├── school-calendars/route.ts   # NEW: fetch school calendarList
│   │   └── user-selections/route.ts    # NEW: read/write course + event selections
│   └── dashboard/
│       └── page.tsx                    # REFACTOR: replace placeholder with sync UI
├── components/
│   ├── CourseAccordion.tsx             # NEW: accordion with checkboxes + color dot
│   ├── SchoolCalendarList.tsx          # NEW: school calendar checkbox list
│   ├── SyncButton.tsx                  # NEW: sticky sync button + progress bar
│   └── SyncSummary.tsx                 # NEW: post-sync summary panel
└── lib/
    ├── db/
    │   └── schema.ts                   # ADD: 4 new tables
    └── gcalSubcalendars.ts             # NEW: sub-calendar creation + caching helper
```

### Pattern 1: Sub-Calendar Per Course

Create one Google Calendar sub-calendar per Canvas course on the personal account. Store the sub-calendar's `calendarId` in DB so it is not re-created on every sync.

```typescript
// Source: googleapis docs + Google Calendar API v3 reference
async function ensureSubCalendar(
  calendarClient: calendar_v3.Calendar,
  summary: string,
  colorId: string
): Promise<string> {
  // Check DB for existing calendarId for this user+course
  // If found, return it
  // If not found, create via calendar.calendars.insert
  const { data } = await calendarClient.calendars.insert({
    requestBody: { summary, colorId }
  });
  // Store data.id in DB; return data.id
  return data.id!;
}
```

**Important:** `calendar.calendars.insert` creates the calendar AND automatically adds it to the authenticated user's `calendarList`. No separate `calendarList.insert` call is required.

### Pattern 2: Bulk Dedup Instead of Per-Event Check

The current `gcalSync.ts` calls `calendar.events.list` once per event to check existence. Replace with a single bulk fetch:

```typescript
// Source: Google Calendar API v3 reference - events.list with privateExtendedProperty
const existing = await calendar.events.list({
  calendarId: subCalendarId,
  privateExtendedProperty: ['canvasSourceCalendarId=canvas'],
  maxResults: 2500,
  singleEvents: true
});
// Build Set of existing UIDs from extendedProperties.private.canvasCanvasUid
// Diff against incoming events
// Batch-insert only new ones; batch-update changed ones
```

### Pattern 3: Drizzle Schema Extension

Add new tables to `src/lib/db/schema.ts`. Use `npx drizzle-kit push` (no migration files) to apply — consistent with the project's existing pattern.

Recommended new tables:

```typescript
// Source: Drizzle ORM docs (drizzle.team/docs/get-started/neon-existing)

// Tracks which courses the user has enabled/disabled
export const courseSelections = pgTable('course_selections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseName: text('course_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  colorId: text('color_id').notNull().default('9'), // Blueberry default
  gcalCalendarId: text('gcal_calendar_id'), // set after first sync
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  userCourseIdx: uniqueIndex('course_sel_user_course_idx').on(t.userId, t.courseName)
}));

// Per-event overrides (only needed if user explicitly toggles an event)
export const eventOverrides = pgTable('event_overrides', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventUid: text('event_uid').notNull(), // Canvas UID
  enabled: boolean('enabled').notNull().default(false), // false = excluded
  customTitle: text('custom_title'), // user-renamed title (null = use AI-cleaned title)
}, (t) => ({
  userEventIdx: uniqueIndex('event_override_user_event_idx').on(t.userId, t.eventUid)
}));

// AI-cleaned titles cache (avoid re-calling AI on every sync)
export const eventTitleCache = pgTable('event_title_cache', {
  id: serial('id').primaryKey(),
  originalTitle: text('original_title').notNull().unique(),
  cleanedTitle: text('cleaned_title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// School calendar mirror selections
export const schoolCalendarSelections = pgTable('school_calendar_selections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolCalendarId: text('school_calendar_id').notNull(), // Google calendarId on school account
  schoolCalendarName: text('school_calendar_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  gcalMirrorCalendarId: text('gcal_mirror_calendar_id'), // sub-calendar on personal account
}, (t) => ({
  userSchoolCalIdx: uniqueIndex('school_cal_sel_user_cal_idx').on(t.userId, t.schoolCalendarId)
}));
```

### Pattern 4: AI Title Cleanup

Use `@anthropic-ai/sdk` with `claude-3-haiku-20240307` (fastest, cheapest). Call server-side during the parse step. Cache results in `event_title_cache` table so repeat syncs don't incur API cost.

```typescript
// Source: platform.claude.com/docs/en/api/messages
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function cleanEventTitle(rawTitle: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    system: 'You clean Canvas assignment titles. Remove bracketed course tags (e.g. [CS 201-001 Spring 2026]), strip boilerplate prefixes like "Submit", and truncate to under 60 characters. Return ONLY the cleaned title, no explanation.',
    messages: [{ role: 'user', content: rawTitle }]
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text.trim() : rawTitle;
}
```

### Pattern 5: Dashboard UI Architecture

The dashboard page should become a Server Component that fetches initial state (user selections, course list from last parse) and passes it as props to a Client Component tree. The accordion, checkboxes, and sync button all need `'use client'` since they are interactive.

```
DashboardPage (Server Component)
  └── SyncDashboard (Client Component — 'use client')
        ├── CourseAccordion (Client)
        │     └── EventRow × N (Client)
        ├── SchoolCalendarList (Client)
        └── SyncButton + SyncSummary (Client)
```

This matches the existing `SetupWizard.tsx` pattern (server passes `currentStep` prop, client handles all interaction state).

### Anti-Patterns to Avoid

- **Calling `events.list` per event for dedup**: 50 events = 50 extra API calls per sync. Use a single bulk `events.list` on the sub-calendar and diff locally.
- **Re-creating sub-calendars on each sync**: Always check DB for a stored `gcal_calendar_id` first. Creating a duplicate calendar on each sync will fill the user's Google Calendar sidebar.
- **Storing access tokens in client state or API request bodies**: The existing `sync-gcal/route.ts` accepts `accessToken` in the request body — this must be removed. Use `getFreshAccessToken(userId, role)` server-side from session.
- **Calling AI title cleanup on every sync**: Cache cleaned titles in DB. Canvas event UIDs are stable — the title won't change between syncs.
- **Using `calendarList.insert` after `calendars.insert`**: `calendars.insert` auto-adds to calendarList. Calling both will error with "Already exists".

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ICS feed parsing | Custom regex/fetch | `node-ical` (already installed) | Handles RRULE, timezone, VEVENT type checking |
| Google Calendar auth | Manual OAuth flow | `getFreshAccessToken()` (already built) + `google.auth.OAuth2` | Token refresh, encryption already handled |
| Dedup logic | Custom MD5/hash of event fields | `extendedProperties.private.canvasCanvasUid` (already implemented) | UID from Canvas ICS is stable and unique |
| AI integration | Custom HTTP fetch to Claude API | `@anthropic-ai/sdk` | Handles retries, rate limits, response parsing |
| Concurrent API calls | Manual Promise queue | Existing `CONCURRENCY = 3` sliding window (replace with batch) | Batch API is simpler and faster |
| Sub-calendar color mapping | Custom color palette | Google's 11 calendar colorIds (1-11) | API enforces these; no custom hex accepted |

---

## Common Pitfalls

### Pitfall 1: Sub-Calendar Duplication
**What goes wrong:** Calling `calendar.calendars.insert` without checking DB first creates duplicate "Canvas - CS 201" calendars on each sync.
**Why it happens:** Sub-calendar creation is not idempotent — the API does not check for existing calendars with the same name.
**How to avoid:** Store the `calendarId` returned by `calendars.insert` in the `courseSelections.gcalCalendarId` column. Always check DB before calling insert.
**Warning signs:** User reports multiple "Canvas - ..." calendars appearing in Google Calendar sidebar.

### Pitfall 2: Raw Access Token in API Request Body
**What goes wrong:** `sync-gcal/route.ts` currently accepts `accessToken` in the POST body. Any client-side code that calls this route exposes the token in browser DevTools network tab.
**Why it happens:** The route was written as a prototype before session auth was established.
**How to avoid:** Refactor route to call `getFreshAccessToken(session.userId, 'personal')` server-side. Remove `accessToken` from the request body contract entirely.
**Warning signs:** Any `fetch('/api/sync-gcal', { body: JSON.stringify({ accessToken: ... }) })` call in client components.

### Pitfall 3: Calendar vs. Event colorId Palettes
**What goes wrong:** Google Calendar has TWO different color palettes — one for calendars (24 colors, IDs 1-24) and one for events (11 colors, IDs 1-11). Mixing them causes silent failures or wrong colors.
**Why it happens:** The API documentation labels both as "colorId" without always clarifying which palette is being referenced.
**How to avoid:** For sub-calendar creation (`calendars.insert`), use calendar colorIds (24 options). For individual event overrides (`events.insert`/`events.update`), use event colorIds (11 options). Since we're using per-course sub-calendars, set color at the sub-calendar level only — do NOT set `colorId` on individual events (this allows users to override colors in Google Calendar).
**Warning signs:** `colorId: "11"` on a calendar request (valid) vs. on an event request (also valid but Tomato for events vs. calendar palette).

The 11 event colorIds are: 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana, 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato.

### Pitfall 4: School Account calendarList.list Scope
**What goes wrong:** `calendar.calendarList.list` on the school account returns ALL calendars, including "Trash", "Birthdays", "Contacts' birthdays" system calendars.
**Why it happens:** Google includes system/default calendars in the calendarList response.
**How to avoid:** Filter by `accessRole` — skip entries where `accessRole === 'freeBusyReader'` or where `id` matches well-known system calendars (e.g., `#contacts@group.v.calendar.google.com`). Only show calendars where `accessRole` is `'owner'` or `'writer'`.
**Warning signs:** Checkbox list shows "Birthdays from contacts" and "Other calendars" section items.

### Pitfall 5: CONCURRENCY = 3 Timeout on Real Datasets
**What goes wrong:** Syncing 80 Canvas events with 2 API calls per event = 160 sequential-within-worker API calls. At ~200ms per call, 3 workers x ~53 calls = ~10+ seconds. Vercel serverless functions timeout at 10s on Hobby plan.
**Why it happens:** Current `syncEvent` does `events.list` + `events.insert`/`events.update` sequentially per event.
**How to avoid:** Replace with bulk dedup approach: one `events.list?maxResults=2500` per sub-calendar to get all existing UIDs, diff locally, then insert/update only changed events. Optionally use the Google Calendar Batch API for the insert/update step (up to 1000 requests per batch HTTP call).
**Warning signs:** Sync timing out on datasets with > 30 events.

### Pitfall 6: AI Title Cleanup Cost Without Caching
**What goes wrong:** Calling `@anthropic-ai/sdk` for every event on every sync call burns API credits on unchanged data.
**Why it happens:** Canvas event UIDs are stable — the assignment title doesn't change between syncs.
**How to avoid:** Use the `event_title_cache` table. On import, check cache by `originalTitle` (or eventUid). Only call Anthropic API for titles not in cache.
**Warning signs:** Anthropic API costs rising linearly with sync frequency × event count.

---

## Code Examples

### Creating a Sub-Calendar
```typescript
// Source: Google Calendar API v3 reference - calendars.insert
const calAuth = new google.auth.OAuth2();
calAuth.setCredentials({ access_token: personalAccessToken });
const calendar = google.calendar({ version: 'v3', auth: calAuth });

const { data } = await calendar.calendars.insert({
  requestBody: {
    summary: 'Canvas - Intro to CS',  // shown in Google Calendar sidebar
    colorId: '9',                      // Blueberry — calendar colorId palette (1-24)
  }
});
const calendarId = data.id; // store this in DB
```

### Listing School Calendars
```typescript
// Source: Google Calendar API v3 reference - calendarList.list
const schoolAuth = new google.auth.OAuth2();
schoolAuth.setCredentials({ access_token: schoolAccessToken });
const schoolCalendar = google.calendar({ version: 'v3', auth: schoolAuth });

const { data } = await schoolCalendar.calendarList.list({
  minAccessRole: 'reader',
});
// Filter system calendars:
const userCalendars = (data.items ?? []).filter(
  (cal) => !['freeBusyReader'].includes(cal.accessRole ?? '') &&
            !cal.id?.endsWith('#contacts@group.v.calendar.google.com')
);
```

### Bulk Dedup and Sync
```typescript
// Source: Google Calendar API v3 reference - events.list with privateExtendedProperty
// Step 1: Fetch all existing Canvas events from this sub-calendar in one call
const { data: existing } = await calendar.events.list({
  calendarId: subCalendarId,
  privateExtendedProperty: ['canvasSourceCalendarId=canvas'],
  maxResults: 2500,
  singleEvents: true,
});
const existingUids = new Set(
  (existing.items ?? [])
    .map(e => e.extendedProperties?.private?.canvasCanvasUid)
    .filter(Boolean)
);

// Step 2: Insert only new events
const newEvents = incomingEvents.filter(e => !existingUids.has(e.uid));
for (const event of newEvents) {
  await calendar.events.insert({
    calendarId: subCalendarId,
    requestBody: {
      summary: event.cleanedTitle,
      description: event.description,
      start: { dateTime: new Date(event.start).toISOString() },
      end: { dateTime: new Date(event.end).toISOString() },
      extendedProperties: {
        private: {
          canvasCanvasUid: event.uid,
          canvasSourceCalendarId: 'canvas',
          canvasCourseName: event.courseName,
        }
      }
    }
  });
}
```

### AI Title Cleanup with Cache
```typescript
// Source: platform.claude.com/docs/en/api/messages
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { eventTitleCache } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getCleanedTitle(rawTitle: string): Promise<string> {
  // Check cache first
  const cached = await db.query.eventTitleCache.findFirst({
    where: eq(eventTitleCache.originalTitle, rawTitle)
  });
  if (cached) return cached.cleanedTitle;

  // Call AI
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 80,
    system: 'You clean Canvas LMS assignment titles. Remove bracketed course codes like [CS 201-001 Spring 2026]. Remove boilerplate like "Submit Assignment:". Keep the assignment name short and clear. Return ONLY the cleaned title.',
    messages: [{ role: 'user', content: rawTitle }]
  });

  const block = response.content[0];
  const cleanedTitle = block.type === 'text' ? block.text.trim() : rawTitle;

  // Store in cache
  await db.insert(eventTitleCache).values({ originalTitle: rawTitle, cleanedTitle });
  return cleanedTitle;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-event `events.list` dedup | Bulk `events.list` + local diff | Phase 2 (this phase) | 50 events = 1 API call instead of 50 |
| Access token in request body | Session-based `getFreshAccessToken()` | Phase 2 (this phase) | Eliminates token exposure risk |
| Single 'primary' calendar | Per-course sub-calendars | Phase 2 (this phase) | Users can toggle visibility per course |
| Raw Canvas title | AI-cleaned title | Phase 2 (this phase) | Removes "[CS 201-001 Spring 2026]" boilerplate |

**Deprecated/outdated in this codebase:**
- `src/app/api/sync-gcal/route.ts` accepting `accessToken` in request body: replace with session auth
- `src/app/api/parse-ics/route.ts` accepting `feedUrl` in request body: replace with stored `canvasIcsUrl` from DB session lookup

---

## Open Questions

1. **Streaming progress vs. polling for sync progress bar**
   - What we know: Vercel supports both SSE (Server-Sent Events) and polling. The sync may take 5-15 seconds.
   - What's unclear: Whether Next.js 16's App Router API routes support streaming `ReadableStream` responses in the same way as Next.js 13-14.
   - Recommendation: Use simple polling (`GET /api/sync/status?jobId=X` every 500ms) as the safe default. SSE is an enhancement if polling proves too coarse-grained.

2. **Event override storage granularity**
   - What we know: Locked decision is "new Canvas events auto-included unless course disabled." Per-event override is "user can uncheck individual events."
   - What's unclear: Should `eventOverrides` store all events (heavy) or only exceptions (light)?
   - Recommendation: Store only exceptions (events the user has explicitly disabled or renamed). Default = enabled = no row in `eventOverrides`. This keeps the table small.

3. **Anthropic API key for title cleanup**
   - What we know: `@anthropic-ai/sdk` is used server-side. Requires `ANTHROPIC_API_KEY` in `.env.local`.
   - What's unclear: Whether the project already has an Anthropic account/API key.
   - Recommendation: Make title cleanup gracefully degrade — if `ANTHROPIC_API_KEY` is not set, fall back to a regex-based cleanup (strip `[...]` suffix) rather than failing.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.ts` at project root |
| Quick run command | `npx jest --testPathPattern="services/" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANVAS-01 | `parseCanvasFeed` returns grouped events from stored URL | unit | `npx jest src/services/icalParser.test.ts -t "grouped"` | Yes (icalParser.test.ts) |
| CANVAS-02 | Course-level selection defaults to enabled; toggling disabled excludes course events | unit | `npx jest src/services/syncFilter.test.ts` | No — Wave 0 |
| CANVAS-03 | Event-level override excludes a single event while course remains enabled | unit | `npx jest src/services/syncFilter.test.ts` | No — Wave 0 |
| CANVAS-04 | Sync creates events on correct sub-calendar; dedup skips existing UIDs | unit | `npx jest src/services/gcalSync.test.ts` | No — Wave 0 |
| CANVAS-05 | Auto-assigned colorIds are distinct across courses; persist in DB | unit | `npx jest src/services/colorAssignment.test.ts` | No — Wave 0 |
| MIRROR-01 | School calendar events are copied to mirror sub-calendar on personal account | unit (mocked googleapis) | `npx jest src/services/schoolMirror.test.ts` | No — Wave 0 |
| MIRROR-02 | Only selected school calendars are mirrored; unselected are skipped | unit | `npx jest src/services/schoolMirror.test.ts` | No — Wave 0 |
| SYNC-01 | POST /api/sync returns progress; summary counts match inserted/updated/skipped | integration (mocked googleapis) | `npx jest src/app/api/sync/route.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="(icalParser|gcalSync|syncFilter)" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/syncFilter.test.ts` — covers CANVAS-02, CANVAS-03 (selection filtering logic)
- [ ] `src/services/gcalSync.test.ts` — covers CANVAS-04 (bulk dedup + sub-calendar targeting)
- [ ] `src/services/colorAssignment.test.ts` — covers CANVAS-05 (color rotation logic)
- [ ] `src/services/schoolMirror.test.ts` — covers MIRROR-01, MIRROR-02 (school calendar mirror)
- [ ] `src/app/api/sync/route.test.ts` — covers SYNC-01 (sync endpoint integration)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/services/gcalSync.ts`, `src/services/icalParser.ts`, `src/lib/db/schema.ts`, `src/lib/tokens.ts` — confirmed patterns, interfaces, and limitations
- [Google Calendar API v3 Reference](https://developers.google.com/workspace/calendar/api/v3/reference) — calendars.insert, calendarList.list, events.list, events.insert API shapes
- [Google Calendar API Batch Requests](https://developers.google.com/calendar/api/guides/batch) — 1000 call limit, multipart/mixed format, processing order
- [Google Calendar colorId gist](https://gist.github.com/ansaso/accaddab0892a3b47d5f4884fda0468b) — verified 11 event colorIds and 24 calendar colorIds with hex values
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) — `messages.create` shape, model names, response extraction
- [Drizzle ORM push docs](https://orm.drizzle.team/docs/drizzle-kit-push) — `npx drizzle-kit push` for schema-first development with Neon

### Secondary (MEDIUM confidence)
- [Drizzle with Neon Postgres](https://neon.com/docs/guides/drizzle-migrations) — confirmed `npx drizzle-kit push` workflow matches project's existing drizzle.config.ts
- [React useOptimistic](https://react.dev/reference/react/useOptimistic) — available in React 19 (project uses react 19.2.3) for optimistic checkbox toggling

### Tertiary (LOW confidence)
- [googleapis-batcher](https://github.com/jrmdayn/googleapis-batcher) — third-party batch library for googleapis client; not verified for production use in this stack. Recommendation: use the bulk-fetch-then-insert approach instead.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries are already installed; only @anthropic-ai/sdk is new
- Architecture: HIGH — patterns derived from existing codebase code review + official API docs
- Pitfalls: HIGH — concurrency bottleneck is explicitly called out in STATE.md; others derived from Google Calendar API documentation quirks
- Schema design: MEDIUM — structure is reasoned from requirements; exact column types may need adjustment during implementation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable APIs; googleapis and Drizzle move slowly)

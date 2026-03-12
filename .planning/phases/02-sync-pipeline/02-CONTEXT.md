# Phase 2: Sync Pipeline - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can select which Canvas courses and school calendars to sync, trigger a manual sync, and see events appear in their personal Google Calendar. Each course gets a distinct color. School calendar events mirror one-way into separate sub-calendars on the personal account. No automatic/scheduled sync in this phase — manual trigger only.

</domain>

<decisions>
## Implementation Decisions

### Course & event selection UI
- Accordion layout: each course is a collapsible section with a course-level checkbox
- Course-level checkbox selects/deselects all events in that course
- Expanded events show: title + due date + truncated description preview
- Selections persist in DB per user across sessions
- New Canvas events auto-included unless their course is disabled — no opt-in required for new events

### Event title cleanup
- AI auto-formats Canvas event titles on import (strip redundant course tags, trim boilerplate)
- User can also manually click to rename any event title
- Only the cleaned/renamed version is displayed — original stored internally for dedup
- School calendar events are NOT cleaned — kept as-is from the institution

### Color assignment
- Auto-assign a distinct Google Calendar color to each course on first import
- Inline color dot on each course row in the accordion header — click to open dropdown of Google's 11 colors
- User can override any auto-assigned color
- Color choices persist in DB per user across sessions
- No overflow handling needed — user will never have more than 11 courses

### School calendar mirroring
- Fetch all calendars from linked school Google account, display as a checkbox list
- User selects which school calendars to mirror (not forced to mirror all)
- Selections persist in DB
- If no school account linked, hide the school calendars section entirely — no empty state

### Calendar organization in Google Calendar
- Create separate Google sub-calendars on the personal account per source
- One sub-calendar per Canvas course (e.g., "Canvas - Intro to CS")
- One sub-calendar per mirrored school calendar (e.g., "School - Class Schedule")
- User can toggle visibility of each independently in Google Calendar's sidebar

### Dashboard layout
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

</decisions>

<specifics>
## Specific Ideas

- Canvas event titles are often unclear/too long (e.g., "Submit Assignment 3: Introduction to Data Structures and Algorithms [CS 201-001 Spring 2026]") — AI cleanup should handle this gracefully
- Accordion mockup: collapsed shows course name + color dot + event count; expanded shows individual events with checkboxes
- The dashboard should feel like a natural evolution of the Phase 1 dashboard placeholder ("Sync features coming soon" → actual sync UI)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `icalParser.ts`: Parses Canvas ICS feeds, groups events by course name — core of CANVAS-01
- `gcalSync.ts`: Creates/updates Google Calendar events with dedup via `extendedProperties.private.canvasCanvasUid` — core of CANVAS-04
- `gcalSync.ts` `SyncResult` interface: Already tracks `inserted`/`updated`/`failed` actions — feeds progress bar
- `getFreshAccessToken(userId, role)`: Retrieves fresh OAuth tokens for personal or school accounts
- `users.canvasIcsUrl`: Canvas ICS URL already stored in DB from Phase 1 wizard step 3
- Dashboard at `/dashboard`: Exists with auth check and placeholder — ready for sync UI

### Established Patterns
- Glassmorphic cards (`bg-white/10`, `backdrop-blur-lg`, `rounded-2xl`) — accordion sections should follow this
- CSS variable theming (`--color-text-primary`, `--color-surface`, `--color-border`) used in dashboard
- Client-side state via React `useState` hooks — no global state management
- API routes at `src/app/api/` with service layer at `src/services/`
- Drizzle ORM with Neon Postgres for persistence

### Integration Points
- `src/app/dashboard/page.tsx`: Replace placeholder content with sync UI components
- `src/app/api/sync-gcal/route.ts`: Needs refactoring — currently accepts raw accessToken, should use session-based auth
- `src/app/api/parse-ics/route.ts`: Needs refactoring — should use stored `canvasIcsUrl` from DB rather than request body
- `src/lib/db/schema.ts`: Will need new tables for course selections, color assignments, school calendar selections
- Google Calendar API: `calendar.calendarList.list` on school account for fetching available calendars
- Google Calendar API: `calendar.calendars.insert` on personal account for creating sub-calendars

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-sync-pipeline*
*Context gathered: 2026-03-12*

# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** Next.js full-stack application with a **three-layer client-server architecture**

**Key Characteristics:**
- Client-side React component initiates two sequential operations
- Server-side API routes handle business logic for parsing and syncing
- Service layer abstracts external integrations (Canvas ICS feeds, Google Calendar API)
- Clear separation between UI coordination, API routing, and data transformation

## Layers

**Presentation (Client):**
- Purpose: Render interactive UI, collect user input (OAuth token and Canvas feed URL), coordinate API calls
- Location: `src/app/page.tsx`, `src/components/CalendarSetup.tsx`
- Contains: React components with Tailwind CSS styling, state management via `useState`
- Depends on: API routes (`/api/parse-ics`, `/api/sync-gcal`)
- Used by: End users via browser

**API Routes (Server Entry Points):**
- Purpose: Handle HTTP requests, validate input, orchestrate services, return JSON responses
- Location: `src/app/api/parse-ics/route.ts`, `src/app/api/sync-gcal/route.ts`
- Contains: Next.js API route handlers that receive POST requests
- Depends on: Service layer (`icalParser`, `gcalSync`)
- Used by: Client-side fetch calls from `CalendarSetup` component

**Services (Business Logic):**
- Purpose: Implement core domain operations (parsing ICS feeds, syncing to Google Calendar)
- Location: `src/services/icalParser.ts`, `src/services/gcalSync.ts`
- Contains: Pure functions and async operations, type definitions
- Depends on: External packages (`node-ical`, `googleapis`)
- Used by: API routes

**Layout (Root):**
- Purpose: Define root HTML structure, load global styles, set metadata
- Location: `src/app/layout.tsx`
- Contains: React root layout wrapping all pages

## Data Flow

**Parse Canvas Feed Flow:**

1. User enters Canvas .ics feed URL in `CalendarSetup` component
2. User clicks "Fetch Feed" button → `handleParse()` executes
3. Client POST to `/api/parse-ics` with `{ feedUrl: string }`
4. `parse-ics/route.ts` validates feedUrl and calls `parseCanvasFeed(feedUrl)`
5. `icalParser.ts` fetches and parses ICS data using `node-ical.async.fromURL()`
6. Events are extracted and grouped by course name (extracted from event summary brackets)
7. Response returns `{ success: true, data: GroupedEvents }` to client
8. Client updates `courses` state with grouped events, displays course list

**Sync to Google Calendar Flow:**

1. User reviews grouped courses and clicks "Push to Google Calendar" button
2. User must provide valid Google OAuth access token in step 1
3. Client POST to `/api/sync-gcal` with `{ accessToken: string, events: CanvasEvent[], courseColorMap: {} }`
4. `sync-gcal/route.ts` validates parameters and calls `syncToGoogleCalendar()`
5. `gcalSync.ts` initializes Google Calendar API client with OAuth credentials
6. For each event, checks if it already exists in Google Calendar using `canvasCanvasUid` extended property
7. If exists: updates event via `calendar.events.update()`
8. If new: inserts event via `calendar.events.insert()`
9. Uses sliding window concurrency (3 workers) to avoid rate limits
10. Returns array of sync results with action type (`inserted`, `updated`, `failed`)
11. Client displays success/failure message

**State Management:**
- Client-side only via React `useState` hooks in `CalendarSetup`
- No persistent state; each operation is stateless relative to the server
- State variables: `feedUrl`, `loading`, `error`, `courses`, `accessToken`

## Key Abstractions

**CanvasEvent:**
- Purpose: Represents a single Canvas assignment/event normalized for Google Calendar
- Examples: `src/services/icalParser.ts` (line 3-10)
- Pattern: TypeScript interface defining event properties (summary, description, dates, course name, uid)
- Used throughout the sync flow to maintain type safety

**GroupedEvents:**
- Purpose: Maps course names to arrays of events for easier display and iteration
- Examples: `src/services/icalParser.ts` (line 12)
- Pattern: `Record<string, CanvasEvent[]>` - a dictionary keyed by course name
- Used by client to display course lists and by sync to flatten for API calls

**SyncOptions & SyncResult:**
- Purpose: Encapsulate parameters and responses for Google Calendar sync operation
- Examples: `src/services/gcalSync.ts` (line 4-15)
- Pattern: Interfaces for type-safe function parameters and return values
- Used in `syncToGoogleCalendar()` function signature

## Entry Points

**Home Page (`src/app/page.tsx`):**
- Location: `src/app/page.tsx`
- Triggers: User navigates to `/` or application root
- Responsibilities: Render page wrapper with gradient background effects, mount `CalendarSetup` component

**Root Layout (`src/app/layout.tsx`):**
- Location: `src/app/layout.tsx`
- Triggers: All page loads (site-wide wrapper)
- Responsibilities: Set HTML metadata, load Google fonts, apply CSS variables, mount `children`

**API Route: Parse ICS (`src/app/api/parse-ics/route.ts`):**
- Location: `src/app/api/parse-ics/route.ts`
- Triggers: POST request from client
- Responsibilities: Validate feedUrl parameter, call `parseCanvasFeed()`, return grouped events or error

**API Route: Sync Google Calendar (`src/app/api/sync-gcal/route.ts`):**
- Location: `src/app/api/sync-gcal/route.ts`
- Triggers: POST request from client after parsing and user authentication
- Responsibilities: Validate access token and events array, call `syncToGoogleCalendar()`, return sync results

## Error Handling

**Strategy:** Synchronous validation at API layer, try-catch blocks in service layer with specific error messages

**Patterns:**
- Input validation: API routes check for required fields and correct types before calling services
- URL validation: `isValidUrl()` function in `icalParser.ts` validates feed URLs before fetching
- Async error propagation: Service errors bubble up to API routes, which return appropriate HTTP status codes
- Client error display: Component catches fetch errors and displays them in red error box
- Differentiated HTTP status codes: 400 for client errors (invalid URL), 500 for server errors (parser/sync failures)

## Cross-Cutting Concerns

**Logging:**
- Client: None (no logging library used)
- Server: `console.error()` called in API routes (lines 25 in parse-ics/route, line 33 in sync-gcal/route) and service (line 84 in gcalSync.ts) for debugging

**Validation:**
- Client: Basic truthy checks (`feedUrl` required to enable button, `accessToken` required for sync)
- Server: Type checking and required field validation in both API routes before calling services

**Authentication:**
- User provides Google OAuth access token as plain text input (development flow)
- Token passed to `gcalSync` service which creates OAuth2 client
- No persistent session or token storage in application (stateless)

**Rate Limiting:**
- Implemented via sliding window concurrency in `syncToGoogleCalendar()` with CONCURRENCY constant = 3 workers
- Prevents burst requests to Google Calendar API that could trigger rate limit errors

---

*Architecture analysis: 2026-03-11*

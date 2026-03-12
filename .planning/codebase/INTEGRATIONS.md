# Integrations

## External APIs

### Canvas LMS (ICS Feed)

- **Type:** Read-only iCal feed
- **Library:** `node-ical` (async URL fetch + parse)
- **Flow:** User provides Canvas ICS URL → `icalParser.ts` fetches and parses → extracts VEVENTs → groups by course name
- **Auth:** Canvas ICS feeds use encrypted/signed URLs (no OAuth needed)
- **Key file:** `src/services/icalParser.ts`

### Google Calendar API

- **Type:** REST API via `googleapis` SDK
- **Library:** `googleapis` (v3 Calendar API)
- **Flow:** User provides OAuth access token → `gcalSync.ts` creates/updates events on Google Calendar
- **Auth:** OAuth 2.0 access token (currently manual paste from OAuth Playground)
- **Operations:**
  - `calendar.events.list` — check if event exists via `extendedProperties.private.canvasCanvasUid`
  - `calendar.events.insert` — create new events
  - `calendar.events.update` — update existing events (upsert pattern)
- **Rate limiting:** Concurrency capped at 3 parallel requests
- **Key file:** `src/services/gcalSync.ts`

## Internal API Routes

- `POST /api/parse-ics` — accepts `{ feedUrl }`, returns grouped events (called by frontend)
- `POST /api/sync-gcal` — accepts `{ accessToken, events, courseColorMap }`, syncs to Google Calendar

**Note:** API route files not found in `src/app/api/` — these may not be implemented yet (frontend references them).

## Databases

None — stateless application, no persistence layer.

## Authentication Providers

- **Google OAuth 2.0** — used for Calendar API access
  - Currently: manual access token input (development/prototype flow)
  - No server-side OAuth flow implemented yet

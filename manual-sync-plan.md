# Canvas to Gcal Manual Sync

## Overview
A web application to parse a Canvas LMS iCalendar (.ics) feed and manually synchronize the extracted events to Google Calendar. The user triggers the synchronization process by clicking a "Sync Now" button after authenticating with Google and providing their feed URL. 

## Project Type
WEB

## Success Criteria
- [ ] Users can log in using their Google Workspace/Gmail account.
- [ ] Users can input their Canvas ICS URL.
- [ ] App successfully fetches and parses the ICS feed immediately upon request.
- [ ] App correctly groups parsed events by their inherent Canvas course names.
- [ ] User can apply specific, granular Google Calendar colors to different courses.
- [ ] Selecting "Sync Now" successfully pushes the events to the user's Google Calendar.
- [ ] The sync accurately reflects the chosen colors.

## Tech Stack
- **Framework:** Next.js (App Router, React, TypeScript). Chosen for robust API routes to handle parsing and seamless frontend integration.
- **Styling:** Tailwind CSS. We will leverage Tailwind's rich utility classes (with potential custom theme extensions) to rapidly build premium aesthetics, glassmorphism UI, and dynamic animations. 
- **ICS Parsing:** `node-ical`. Standard-compliant and reliable parser for complex Canvas calendar feeds.
- **Google Calendar Integration:** `googleapis` Node module for authenticated Google Calendar v3 API access.
- **Testing:** `vitest` + `@testing-library/react` to enforce strict TDD.

## File Structure
```
/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          (Main UI: Input, Filter, Sync)
│   │   ├── globals.css       (Tailwind directives, base styles)
│   │   └── api/
│   │       ├── parse-ics/    (API route: Fetches and parses Canvas feed)
│   │       └── sync-gcal/    (API route: Handles Google Calendar push)
│   ├── components/
│   │   ├── CalendarSetup.tsx (UI Component for configuration)
│   │   └── CalendarSetup.test.tsx 
│   ├── services/
│   │   ├── icalParser.ts     (Core logic: ICS parsing & filtering)
│   │   ├── icalParser.test.ts
│   │   ├── gcalSync.ts       (Core logic: Google API interaction)
│   │   └── gcalSync.test.ts
├── package.json
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
```

## Task Breakdown

### Phase 1: Planning and Setup (Completed)
- **Task ID:** setup-01
- **Name:** Project and TDD Initialization
- **Agent:** backend-specialist
- **Skill:** clean-code, testing-patterns
- **Priority:** P0
- **Dependencies:** None
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: Current workspace
  - *Output*: Next.js initialization, Vitest setup
  - *Verify*: `npm run test` executes successfully indicating a working TDD environment.

### Phase 2: Core Logic (Backend API & Services)
- **Task ID:** backend-01
- **Name:** ICS Parsing Service (TDD)
- **Agent:** backend-specialist
- **Skill:** nodejs-best-practices, testing-patterns
- **Priority:** P1
- **Dependencies:** setup-01
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: Sample Canvas `.ics` feed URL
  - *Output*: `icalParser.ts` service that fetches the URL, parses events, and groups by course.
  - *Verify*: `icalParser.test.ts` passes, confirming accurate event extraction.

- **Task ID:** backend-02
- **Name:** ICS Parse API Route
- **Agent:** backend-specialist
- **Skill:** nodejs-best-practices
- **Priority:** P1
- **Dependencies:** backend-01
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: HTTP POST with Canvas URL
  - *Output*: JSON response containing grouped events
  - *Verify*: Next.js API route returns 200 OK with correct JSON payload using Postman/CURL.

- **Task ID:** backend-03
- **Name:** Google Calendar Sync Service (TDD)
- **Agent:** backend-specialist
- **Skill:** api-patterns, testing-patterns
- **Priority:** P1
- **Dependencies:** backend-01
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: List of parsed events, Google OAuth Token, Course-to-Color mappings
  - *Output*: `gcalSync.ts` service interacting with `googleapis`
  - *Verify*: `gcalSync.test.ts` with mocked `googleapis` verifies correct payload structure.

### Phase 3: Frontend & UI Validation
- **Task ID:** frontend-01
- **Name:** Calendar Setup UI (TDD)
- **Agent:** frontend-specialist
- **Skill:** frontend-design, react-best-practices
- **Priority:** P2
- **Dependencies:** setup-01
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: User interaction (Url input, color selection)
  - *Output*: `CalendarSetup.tsx` and accompanying Tailwind configurations
  - *Verify*: `CalendarSetup.test.tsx` passes; visual inspection demonstrates dynamic animations and glassmorphism.

- **Task ID:** frontend-02
- **Name:** Google Auth Integration & Main Page
- **Agent:** frontend-specialist
- **Skill:** frontend-design
- **Priority:** P2
- **Dependencies:** frontend-01, backend-02
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: `CalendarSetup` component and Next.js page
  - *Output*: Integrated `page.tsx` managing state, OAuth flow, and invoking API routes
  - *Verify*: User can end-to-end authenticate, view courses, and trigger sync.

### Phase 4: Verification
- **Task ID:** verify-01
- **Name:** Final System Verification
- **Agent:** QA-automation-engineer
- **Skill:** webapp-testing
- **Priority:** P3
- **Dependencies:** frontend-02, backend-03
- **INPUT → OUTPUT → VERIFY:**
  - *Input*: Complete application
  - *Output*: Verified, ready to deploy app
  - *Verify*: Run Phase X required scripts (Lint, Build, Manual Testing).

## Phase X: Verification
- [ ] Lint: Pass
- [ ] Build: Success
- [ ] Run & Test: Success
- Date: [Pending]

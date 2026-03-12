# Codebase Structure

**Analysis Date:** 2026-03-11

## Directory Layout

```
canvas-to-gcal/
├── src/                    # Application source code
│   ├── app/               # Next.js app directory (routing, layouts, API)
│   │   ├── api/           # API routes (server endpoints)
│   │   │   ├── parse-ics/ # Canvas ICS parsing endpoint
│   │   │   └── sync-gcal/ # Google Calendar sync endpoint
│   │   ├── layout.tsx     # Root layout wrapper (global metadata, fonts)
│   │   ├── page.tsx       # Home page component
│   │   └── globals.css    # Global Tailwind styles
│   ├── components/        # Reusable React components
│   │   └── CalendarSetup.tsx  # Main interactive component (parsing, syncing UI)
│   └── services/          # Business logic services
│       ├── icalParser.ts       # Canvas ICS feed parsing service
│       ├── icalParser.test.ts  # Unit tests for parser
│       └── gcalSync.ts         # Google Calendar sync service
├── public/                # Static assets (SVG icons, favicon)
├── .planning/            # GSD planning documents and analysis
├── .next/                # Next.js build output (generated)
├── .swc/                 # SWC compiler cache (generated)
├── node_modules/         # NPM dependencies (not committed)
├── jest.config.js        # Jest test runner configuration
├── jest.setup.js         # Jest setup file for test environment
├── tsconfig.json         # TypeScript compiler configuration
├── next.config.ts        # Next.js build configuration
├── eslint.config.mjs     # ESLint linting configuration
├── postcss.config.mjs    # PostCSS CSS processing configuration
├── package.json          # NPM dependencies and scripts
├── package-lock.json     # Locked dependency versions
└── README.md             # Project documentation
```

## Directory Purposes

**src/:**
- Purpose: Root source directory containing all application code
- Contains: App routing structure, components, services, styles
- Key files: Entry points are in `app/` subdirectory

**src/app/:**
- Purpose: Next.js app directory - defines routing and page structure
- Contains: Layout wrapper, pages, API routes
- Key files: `layout.tsx`, `page.tsx`

**src/app/api/:**
- Purpose: Next.js API route handlers (server endpoints)
- Contains: HTTP route handlers that receive and process requests
- Key files: `parse-ics/route.ts`, `sync-gcal/route.ts`

**src/app/api/parse-ics/:**
- Purpose: API endpoint for parsing Canvas ICS feeds
- Contains: Single POST route handler
- Key files: `route.ts` - parses Canvas .ics URL and returns grouped events

**src/app/api/sync-gcal/:**
- Purpose: API endpoint for syncing parsed events to Google Calendar
- Contains: Single POST route handler
- Key files: `route.ts` - accepts events and access token, returns sync results

**src/components/:**
- Purpose: Reusable React components for UI
- Contains: Client-side interactive components with hooks
- Key files: `CalendarSetup.tsx` - main UI orchestrating parsing and syncing flows

**src/services/:**
- Purpose: Business logic layer - data transformation and external integrations
- Contains: Pure functions and service classes for domain operations
- Key files: `icalParser.ts`, `gcalSync.ts`, test files

**public/:**
- Purpose: Static assets served directly by web server
- Contains: SVG icons and favicon images
- Key files: Standard Next.js assets (not application-critical)

**.planning/:**
- Purpose: GSD analysis and planning documents
- Contains: Codebase analysis files (ARCHITECTURE.md, STRUCTURE.md, etc.)

**.next/:**
- Purpose: Next.js build output directory (generated during build)
- Contains: Compiled JavaScript, server functions, static exports
- Generated: Yes
- Committed: No

**.swc/:**
- Purpose: SWC compiler cache for faster rebuilds
- Generated: Yes
- Committed: No

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout that wraps entire application
- `src/app/page.tsx`: Home page component (rendered at `/`)
- `src/app/api/parse-ics/route.ts`: API endpoint at `POST /api/parse-ics`
- `src/app/api/sync-gcal/route.ts`: API endpoint at `POST /api/sync-gcal`

**Configuration:**
- `tsconfig.json`: TypeScript compiler options (strict mode, path aliases `@/*`)
- `next.config.ts`: Next.js build and runtime configuration
- `jest.config.js`: Jest test runner configuration with jsdom environment
- `postcss.config.mjs`: PostCSS plugins (Tailwind CSS processing)
- `eslint.config.mjs`: ESLint rules and style enforcement
- `package.json`: NPM dependencies and build scripts

**Core Logic:**
- `src/services/icalParser.ts`: Canvas ICS parsing logic, course grouping, type definitions
- `src/services/gcalSync.ts`: Google Calendar API integration, event sync with concurrency control
- `src/components/CalendarSetup.tsx`: React component with state management and API coordination

**Testing:**
- `src/services/icalParser.test.ts`: Unit tests for ICS parser (Jest with mocking)
- `jest.setup.js`: Test environment setup
- `jest.config.js`: Jest configuration

## Naming Conventions

**Files:**
- API routes: `route.ts` (Next.js convention)
- React components: PascalCase with `.tsx` extension (e.g., `CalendarSetup.tsx`)
- Services: camelCase with `.ts` extension (e.g., `icalParser.ts`, `gcalSync.ts`)
- Tests: `[name].test.ts` or `[name].spec.ts` suffix (e.g., `icalParser.test.ts`)
- Config files: Either `.config.js`, `.config.mjs`, or dot-prefixed (`.eslintrc`, `tsconfig.json`)

**Directories:**
- Functional directories: lowercase and pluralized when containing multiple items (e.g., `components/`, `services/`)
- Feature/route directories: kebab-case when representing URL paths (e.g., `parse-ics/`, `sync-gcal/`)
- Single-item directories: lowercase (e.g., `app/`)

**Functions:**
- Service functions: camelCase (e.g., `parseCanvasFeed()`, `syncToGoogleCalendar()`)
- Helper functions: camelCase prefixed with verb (e.g., `isValidUrl()`, `extractCourseName()`)
- React components: PascalCase (e.g., `CalendarSetup`, `Home`)

**Types & Interfaces:**
- Interfaces: PascalCase (e.g., `CanvasEvent`, `GroupedEvents`, `SyncOptions`, `SyncResult`)
- Type aliases: PascalCase (e.g., `GroupedEvents = Record<string, CanvasEvent[]>`)

## Where to Add New Code

**New Feature:**
- Primary code: Add service function in `src/services/[feature].ts`
- API endpoint: Create new directory `src/app/api/[endpoint]/route.ts`
- UI: Add component in `src/components/[Feature].tsx` if needed, or extend `CalendarSetup.tsx`
- Tests: Create `src/services/[feature].test.ts` alongside service

**New Component/Module:**
- Implementation: `src/components/[ComponentName].tsx` for client components (mark with `'use client'`)
- Alternative: Place in `src/app/` if it's a new page or layout
- Styling: Use Tailwind CSS classes inline (no separate CSS files currently)
- Export: Can use `export default` or named exports

**Utilities:**
- Shared helpers: Create `src/utils/[utility].ts` (currently no utils/ directory, but follows convention)
- Service helpers: Keep within `src/services/` module they support
- Type definitions: Export from service module where used (e.g., `CanvasEvent` from `icalParser.ts`)

## Special Directories

**node_modules/:**
- Purpose: NPM package dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**.next/:**
- Purpose: Next.js compilation output
- Generated: Yes (during build)
- Committed: No

**.swc/:**
- Purpose: SWC compiler cache
- Generated: Yes (during build/dev)
- Committed: No

**.planning/:**
- Purpose: GSD analysis documents
- Generated: Manually via GSD commands
- Committed: Yes (tracked in git)

## Import Paths

**Path Alias Configuration:**
- Alias: `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Usage: `import { parseCanvasFeed } from '@/services/icalParser'` instead of relative paths
- Benefits: Readable, refactor-safe, works in all file types

**Import Order Convention (observed in codebase):**
1. React and Next.js imports (e.g., `import React`, `import { useState }`, `import { NextResponse }`)
2. Third-party library imports (e.g., `import ical`, `import { google }`)
3. Local service imports (e.g., `import { parseCanvasFeed } from '@/services/icalParser'`)
4. Component imports (e.g., `import CalendarSetup`)

---

*Structure analysis: 2026-03-11*

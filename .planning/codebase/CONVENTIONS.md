# Conventions

## Code Style

- **TypeScript** strict-ish (standard Next.js tsconfig)
- **ES modules** for config files (`.mjs` extensions)
- **CommonJS** for Jest config (`jest.config.js`)
- Single quotes in test files, mixed in components
- Semicolons used consistently

## Naming

- **Files:** camelCase for services (`icalParser.ts`, `gcalSync.ts`), PascalCase for components (`CalendarSetup.tsx`)
- **Functions:** camelCase (`parseCanvasFeed`, `syncToGoogleCalendar`, `extractCourseName`)
- **Interfaces/Types:** PascalCase (`CanvasEvent`, `GroupedEvents`, `SyncOptions`, `SyncResult`)
- **Constants:** UPPER_SNAKE_CASE (`CONCURRENCY`)

## Patterns

- **Service layer:** Business logic in `src/services/` (separate from UI and API routes)
- **Client components:** Explicit `'use client'` directive
- **Error handling:** try/catch with typed error narrowing (`err instanceof Error ? err.message : '...'`)
- **State management:** React `useState` hooks (no external state library)
- **Async patterns:** `async/await` throughout, `Promise.all` for concurrency
- **Type exports:** Interfaces and types exported from service files for reuse

## Component Patterns

- Functional components with hooks
- Tailwind CSS for all styling (no CSS modules or styled-components)
- Glassmorphism design aesthetic (backdrop-blur, white/opacity borders)
- Loading/error states managed with local useState

## Error Handling

- Services throw typed errors (`throw new Error('Invalid feed URL')`)
- Components catch errors and display in UI via error state
- Console.error for non-critical failures in sync operations
- No global error boundary observed

## Path Aliases

- `@/` maps to `src/` (configured in tsconfig and jest)

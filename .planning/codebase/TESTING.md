# Testing

## Framework

- **Jest 30.3.0** with `ts-jest` for TypeScript
- **next/jest** wrapper for Next.js integration
- **jsdom** test environment
- **@testing-library/react** + **@testing-library/jest-dom** available

## Configuration

- `jest.config.js` — uses `next/jest` helper, maps `@/` alias
- `jest.setup.js` — setup file referenced in config

## Test Files

| File | Tests | What it covers |
|------|-------|---------------|
| `src/services/icalParser.test.ts` | 2 | Feed parsing, course grouping, URL validation |

## Test Patterns

- **Mocking:** `jest.mock('node-ical')` with manual factory for async methods
- **Assertions:** `expect(...).toHaveBeenCalledWith()`, `expect(...).rejects.toThrow()`
- **Structure:** `describe` → `beforeEach` (clearAllMocks) → `it` blocks
- **Data:** Inline mock ICS data objects (not fixture files)

## Coverage

- **Tested:** `icalParser.ts` (parsing logic, URL validation, course grouping)
- **Untested:** `gcalSync.ts` (Google Calendar sync), `CalendarSetup.tsx` (UI component), API routes
- No coverage thresholds configured
- No CI test pipeline observed

## Running Tests

```bash
npx jest
```

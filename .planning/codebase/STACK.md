# Stack

## Language & Runtime

- **TypeScript** (~5.x) — primary language for all source code
- **Node.js** — server runtime (Next.js API routes)

## Framework

- **Next.js 16.1.6** (App Router) — full-stack React framework
  - App Router with `src/app/` directory structure
  - API routes (expected at `src/app/api/`)
  - Server-side rendering for pages
  - `serverExternalPackages: ['node-ical']` in `next.config.ts`

## Frontend

- **React 19.2.3** — UI library
- **Tailwind CSS v4** — utility-first CSS via `@tailwindcss/postcss`
- **PostCSS** — CSS processing (`postcss.config.mjs`)

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `node-ical` | ^0.25.5 | Parse ICS/iCal feeds from Canvas |
| `googleapis` | ^171.4.0 | Google Calendar API client |
| `next` | 16.1.6 | Full-stack framework |
| `react` / `react-dom` | 19.2.3 | UI rendering |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^30.3.0 | Test runner |
| `ts-jest` | ^29.4.6 | TypeScript transform for Jest |
| `@testing-library/react` | ^16.3.2 | React component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM assertion matchers |
| `eslint` + `eslint-config-next` | ^9 / 16.1.6 | Linting |
| `typescript` | ^5 | Type checking |

## Configuration Files

- `tsconfig.json` — TypeScript config with `@/` path alias to `src/`
- `next.config.ts` — Next.js config, marks `node-ical` as external
- `jest.config.js` — Jest config via `next/jest`, jsdom environment
- `jest.setup.js` — Test setup file
- `eslint.config.mjs` — ESLint flat config
- `postcss.config.mjs` — PostCSS with Tailwind plugin

## Build & Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

# Coursemap

Sync your Canvas assignments and school calendar events into Google Calendar — automatically organized by course and event type.

## What it does

Coursemap connects to your Canvas ICS feed and syncs all assignments, quizzes, exams, labs, and other events into Google Calendar. Each course gets its own sub-calendar per event type, color-coded and organized. Syncs run daily at 6 AM UTC via cron, or on-demand from the dashboard.

**Features:**
- Parses Canvas ICS feed and classifies events by type (Assignment, Quiz, Exam, Lab, Discussion, etc.)
- Creates per-(course, type) sub-calendars in your personal Google Calendar
- Optional school Google account link to mirror school-managed calendars
- Toggle courses and individual events on/off; customize event titles
- AI-assisted event classification (Claude Haiku) with regex fast-path and DB caching
- Encrypted OAuth token storage (AES-256-GCM)

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Neon PostgreSQL** + **Drizzle ORM**
- **Google Calendar API** via OAuth 2.0 (personal + school accounts)
- **Canvas ICS** feed via `node-ical`
- **Anthropic Claude** (event classification + title cleanup)
- Deployed on **Vercel** with cron

## Setup

### Prerequisites

- [Neon](https://neon.tech) Postgres project
- [Google Cloud](https://console.cloud.google.com) OAuth 2.0 credentials with Calendar scope
- [Anthropic](https://console.anthropic.com) API key (optional — used for event classification)

### 1. Clone and install

```bash
git clone <repo-url>
cd canvas-to-gcal
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
# Neon Postgres connection string
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# JWT session secret (min 32 bytes — generate below)
SESSION_SECRET=

# AES-256-GCM token encryption key (32 bytes base64 — generate below)
TOKEN_ENCRYPTION_KEY=

# App URL (no trailing slash)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Claude API key (optional)
ANTHROPIC_API_KEY=sk-ant-...
```

Generate secrets:

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# TOKEN_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Google OAuth redirect URIs

Add both to your Google Cloud OAuth client's authorized redirect URIs:

```
http://localhost:3000/login/google/callback
http://localhost:3000/link/school-google/callback
```

### 4. Run migrations and start

```bash
npm run dev
```

Drizzle migrations run automatically on startup. Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm test         # Jest tests
```

## Deployment

Deploy to Vercel. Set all environment variables in project settings, updating `NEXT_PUBLIC_BASE_URL` to your production domain. The `vercel.json` cron job triggers `/api/cron/sync` daily at 6 AM UTC.

Update your Google OAuth client's authorized redirect URIs to use your production domain.

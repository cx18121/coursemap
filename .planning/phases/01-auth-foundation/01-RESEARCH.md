# Phase 1: Auth Foundation - Research

**Researched:** 2026-03-12
**Domain:** Google OAuth 2.0 (dual-account), session management, encrypted token persistence, Neon Postgres + Drizzle ORM
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sign-in flow**
- Step-by-step wizard: Step 1 = connect personal Google, Step 2 = link school Google, Step 3 = paste Canvas ICS URL
- School account linking is optional — user can skip and add it later
- Wizard appears on every visit until at least personal account is connected and Canvas URL is saved
- Progress bar shows current step (1 of 3, 2 of 3, 3 of 3)

**Account management**
- Account info lives in a header/nav bar dropdown — always accessible
- Dropdown shows email + role label ("Personal" / "School") for each connected account
- If school account not linked, dropdown includes a "Link school account" option
- Single "Sign out" action clears everything (no per-account disconnect)

**Session & return visits**
- Returning users with valid session go straight to dashboard — no splash screen
- Multi-user support from the start — each Google sign-in creates a separate user record, DB stores tokens per user
- Sign-out clears session cookie and DB tokens, redirects to setup wizard

**Auth failure handling**
- School OAuth blocked by institution: clear message explaining restriction + "Try again" and "Skip for now" buttons
- Token refresh failure: non-blocking banner at top with "Reconnect" button — don't auto sign out
- Partial failure (school token fails, personal fine): degrade gracefully — Canvas ICS sync keeps working, only school calendar mirroring disabled, subtle indicator that school needs reconnection
- Error messages: simple and actionable, 3 categories max: "connection expired" (reconnect), "access denied" (try again/skip), "something went wrong" (retry). No technical details shown to user

### Claude's Discretion
- Session TTL duration (Claude to pick appropriate value)
- Exact progress bar / wizard styling
- Session cookie implementation details
- DB schema design for user and token tables
- Token encryption approach

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with personal Google account via OAuth | Arctic v3 Google provider + authorization code flow with PKCE; App Router route handlers at `/login/google` and `/login/google/callback` |
| AUTH-02 | User can link school Google account as a second OAuth connection | Second Arctic Google client with same client ID; separate DB row keyed on `role: "school"`; link flow triggered from session with existing personal token |
| AUTH-03 | OAuth tokens persist across sessions (encrypted storage) | Neon Postgres + Drizzle ORM; AES-256-GCM encryption via Node.js `crypto`; `oauth_tokens` table stores encrypted `access_token` + `refresh_token` per user per role |
| AUTH-04 | App automatically refreshes expired tokens without user action | `arctic.google.refreshAccessToken(refreshToken)` on 401/expiry; silent refresh in API route middleware before each downstream call; non-blocking banner only on refresh failure |
</phase_requirements>

---

## Summary

This phase introduces a custom OAuth layer (Arctic v3 + jose) over a Neon Postgres database (Drizzle ORM) to store encrypted Google tokens for two accounts per user. NextAuth was ruled out because its session model cannot natively carry two independent Google OAuth connections — cookies would overflow at 4 KB and per-account refresh logic becomes unmanageable. The decided approach (confirmed in STATE.md) stores tokens server-side in the database and uses a lightweight session cookie (jose-encrypted JWT) that only carries a session ID and user ID.

The dual-account linking pattern is handled by running the authorization flow a second time from within an authenticated session. The callback route reads the session cookie to identify the current user, then inserts a second token row (role = "school") rather than creating a new user. Arctic's `decodeIdToken()` extracts email and sub (Google ID) from both flows without a separate userinfo HTTP call.

The most operationally critical concern, documented in STATE.md, is that the Google Cloud OAuth consent screen must be published to **Production** before any real users authenticate. In Testing mode, refresh tokens expire in 7 days regardless of usage. Google Workspace for Education institutions may also restrict third-party OAuth; the wizard must handle this with a clear, non-fatal message (covered in auth failure handling decisions).

**Primary recommendation:** Use Arctic v3 + jose + Neon/Drizzle as decided. Implement a `lib/auth.ts` (Arctic client), `lib/session.ts` (jose encrypt/decrypt), `lib/db/schema.ts` (Drizzle schema), and route handlers under `app/login/google/` and `app/login/google/callback/`. Encrypt tokens in DB with AES-256-GCM (Node.js `crypto`). Validate session in Next.js middleware via cookie decrypt (optimistic) + DB verify on sensitive operations.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `arctic` | v3 (latest) | OAuth 2.0 client for Google; generates authorization URLs, validates codes, refreshes tokens | Lightweight, runtime-agnostic, no magic — explicit control over every token; chosen in STATE.md because NextAuth breaks on dual-account |
| `jose` | ^5 | Encrypt/decrypt session JWT stored in httpOnly cookie | Official Next.js recommendation for stateless session encryption; runs in Edge runtime |
| `@neondatabase/serverless` | latest | Neon Postgres HTTP driver | Optimized for serverless/edge; zero cold-start connection overhead |
| `drizzle-orm` | ^0.40 | Type-safe query builder + schema definition | SQL-first, fully typed, minimal abstraction — pairs naturally with Neon serverless driver |
| `drizzle-kit` | ^0.30 | Migration CLI (`drizzle-kit generate`, `drizzle-kit migrate`) | Companion tool for Drizzle ORM migrations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | — | AES-256-GCM encryption of token strings before DB write | Always — no additional install needed; encrypt every token at rest |
| `next` cookies API (`next/headers`) | 16.x | Read/write httpOnly cookies in Route Handlers and Server Components | All auth routes and middleware |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| arctic + jose | NextAuth / Auth.js | NextAuth was explicitly rejected (STATE.md) — session model cannot carry two independent Google connections; cookie overflows at 4 KB with two account token sets |
| Neon Postgres | PlanetScale / Supabase | Neon was decided; serverless Postgres is the correct category; Neon's HTTP driver has best-in-class cold-start |
| Drizzle ORM | Prisma | Drizzle decided; lighter, no code generation daemon, SQL-first |
| AES-256-GCM (crypto) | pgcrypto extension | pgcrypto adds operational complexity; application-layer encryption keeps key management in env vars and is simpler for a personal-use app |

**Installation:**
```bash
npm install arctic jose @neondatabase/serverless drizzle-orm
npm install -D drizzle-kit
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── login/
│   │   └── google/
│   │       ├── route.ts          # Step 1: generate auth URL, set state+verifier cookies
│   │       └── callback/
│   │           └── route.ts      # Step 2: validate code, upsert user+token, set session cookie
│   ├── link/
│   │   └── school-google/
│   │       ├── route.ts          # Authenticated: generate second auth URL
│   │       └── callback/
│   │           └── route.ts      # Insert school token row for existing user
│   ├── api/
│   │   └── auth/
│   │       └── signout/
│   │           └── route.ts      # Delete session cookie + DB tokens
│   ├── dashboard/
│   │   └── page.tsx              # Protected; redirected to from wizard on completion
│   └── page.tsx                  # Root: auth-aware routing (wizard vs dashboard)
├── components/
│   ├── SetupWizard.tsx           # Steps 1-3 shell with progress bar
│   ├── AccountDropdown.tsx       # Nav bar dropdown: emails, roles, Link school, Sign out
│   └── ReconnectBanner.tsx       # Non-blocking token refresh failure banner
├── lib/
│   ├── auth.ts                   # Arctic Google client(s) + generateState/generateCodeVerifier
│   ├── session.ts                # jose encrypt/decrypt; getSession(); setSessionCookie()
│   ├── tokens.ts                 # encryptToken() / decryptToken() via AES-256-GCM
│   └── db/
│       ├── index.ts              # Drizzle client (Neon HTTP)
│       └── schema.ts             # users, oauth_tokens, sessions tables
├── middleware.ts                 # Optimistic session check: redirect unauthenticated → /login
└── services/
    ├── gcalSync.ts               # (existing) — will be refactored to pull token from DB
    └── icalParser.ts             # (existing)
```

### Pattern 1: OAuth Authorization Code Flow with PKCE (Arctic v3)

**What:** Two-step browser redirect flow — user goes to Google, Google returns `code`, callback exchanges code for tokens.
**When to use:** Every time a new Google account is being connected (both personal and school).

```typescript
// Source: https://arcticjs.dev/providers/google
// lib/auth.ts
import { Google, generateState, generateCodeVerifier } from "arctic";

export const googleClient = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_BASE_URL}/login/google/callback`
);

// app/login/google/route.ts
import { cookies } from "next/headers";
import { googleClient, generateState, generateCodeVerifier } from "@/lib/auth";

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const scopes = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar"];

  const url = googleClient.createAuthorizationURL(state, codeVerifier, scopes);
  url.searchParams.set("access_type", "offline");
  // prompt=consent only needed if re-authorizing to force a new refresh token
  // Do NOT set prompt=consent on every login — Google caps refresh tokens at 100 per account per client

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set("google_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    sameSite: "lax",
    path: "/",
  });

  return Response.redirect(url);
}
```

### Pattern 2: Callback — Validate Code, Upsert User + Token

```typescript
// Source: https://arcticjs.dev/providers/google + https://lucia-auth.com/tutorials/google-oauth/nextjs
// app/login/google/callback/route.ts
import { googleClient } from "@/lib/auth";
import { decodeIdToken } from "arctic";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { setSessionCookie } from "@/lib/session";
import { encryptToken } from "@/lib/tokens";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  const codeVerifier = cookieStore.get("google_code_verifier")?.value;

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const tokens = await googleClient.validateAuthorizationCode(code, codeVerifier);
  const idToken = tokens.idToken();
  const claims = decodeIdToken(idToken) as { sub: string; email: string; name: string };

  // Upsert user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, claims.sub));

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ googleId: claims.sub, email: claims.email, name: claims.name })
      .returning();
  }

  // Store encrypted tokens (role = "personal")
  const encryptedAccess = encryptToken(tokens.accessToken());
  const encryptedRefresh = tokens.hasRefreshToken()
    ? encryptToken(tokens.refreshToken())
    : null;

  await db
    .insert(oauthTokens)
    .values({
      userId: user.id,
      role: "personal",
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
    })
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.role],
      set: {
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
      },
    });

  await setSessionCookie(user.id);
  return Response.redirect(new URL("/", request.url));
}
```

### Pattern 3: Session Cookie (jose)

**What:** Short-lived encrypted JWT in an httpOnly cookie carries only userId. No tokens in the cookie.
**Recommended TTL:** 30 days (rolling). Session refreshes on each valid request if <15 days remain.

```typescript
// Source: https://nextjs.org/docs/pages/building-your-application/authentication
// lib/session.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = "session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function encryptSession(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function decryptSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    return payload as { userId: number; exp: number };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number) {
  const token = await encryptSession({ userId });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decryptSession(token);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

### Pattern 4: Token Encryption at Rest (AES-256-GCM)

**What:** Encrypt every OAuth token string before writing to DB; decrypt on read.

```typescript
// Source: Node.js crypto docs + community patterns
// lib/tokens.ts
import crypto from "crypto";

const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64"); // 32 bytes, base64 encoded

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: base64(iv):base64(tag):base64(ciphertext)
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

// Generate TOKEN_ENCRYPTION_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Pattern 5: Drizzle Schema

```typescript
// Source: https://lucia-next.pages.dev/sessions/basic-api/drizzle-orm + https://orm.drizzle.team/docs/column-types/pg
// lib/db/schema.ts
import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  canvasIcsUrl: text("canvas_ics_url"),          // Phase 1 stores this too (wizard step 3)
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["personal", "school"] }).notNull(), // role label
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token"),         // null if not granted
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
// Unique constraint: one row per (userId, role)
// CREATE UNIQUE INDEX ON oauth_tokens (user_id, role);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),                   // SHA-256 hash of raw session token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
});
```

### Pattern 6: Middleware (Optimistic Session Check)

```typescript
// Source: https://nextjs.org/docs/pages/building-your-application/authentication
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/login/google", "/login/google/callback"];

export async function middleware(req: NextRequest) {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const sessionToken = req.cookies.get("session")?.value;
  const session = sessionToken ? await decryptSession(sessionToken) : null;

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isPublic && session && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Pattern 7: Silent Token Refresh

**What:** Before making a Google API call, check token expiry. If expired, call `googleClient.refreshAccessToken()`, persist new encrypted token to DB, proceed with new token.

```typescript
// Conceptual pattern — used in service layer before any Google API call
import { googleClient } from "@/lib/auth";
import { encryptToken, decryptToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getFreshAccessToken(userId: number, role: "personal" | "school"): Promise<string | null> {
  const [row] = await db.select().from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.role, role)));

  if (!row) return null;

  // If token expires in < 5 minutes, refresh proactively
  const isExpired = row.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (!isExpired) {
    return decryptToken(row.encryptedAccessToken);
  }

  if (!row.encryptedRefreshToken) return null; // no refresh token; needs reconnection

  try {
    const refreshed = await googleClient.refreshAccessToken(
      decryptToken(row.encryptedRefreshToken)
    );
    await db.update(oauthTokens)
      .set({
        encryptedAccessToken: encryptToken(refreshed.accessToken()),
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt(),
        updatedAt: new Date(),
      })
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.role, role)));

    return refreshed.accessToken();
  } catch {
    return null; // caller shows ReconnectBanner
  }
}
```

### Anti-Patterns to Avoid

- **Storing tokens in cookies:** Cookie max size is 4 KB. Two Google token sets (access + refresh) easily exceed this. Store only the session ID / encrypted session payload in the cookie; put tokens in the DB.
- **Setting `prompt=consent` on every login:** Google caps refresh tokens at 100 per account per OAuth client. Only set `prompt=consent` when the user explicitly needs to re-grant (e.g., after a revoke).
- **Calling `decryptIdToken` then hitting the userinfo endpoint:** `decodeIdToken` from Arctic extracts `sub`, `email`, `name`, and `picture` without an extra HTTP call. The userinfo endpoint is redundant for this use case.
- **Using `Math.random()` for state or session tokens:** Must use `crypto.randomBytes()` or Arctic's `generateState()` / `generateCodeVerifier()`.
- **Relying solely on middleware for auth:** CVE-2025-29927 (Next.js middleware auth bypass) demonstrated that middleware must be backed by server-side DAL checks on sensitive operations. Session cookie decrypt in middleware is optimistic only.
- **Leaving OAuth app in Testing mode for deployed users:** Refresh tokens expire in 7 days in Testing mode. Publish to Production in Google Cloud Console before any real user signs in.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth authorization URL + PKCE | Custom URL builder | `arctic` Google client | PKCE, state, scope encoding have subtle correctness requirements; Arctic is spec-compliant |
| JWT session encrypt/decrypt | Custom HMAC scheme | `jose` (SignJWT / jwtVerify) | jose is audited, handles algorithm selection, expiry, and key encoding correctly |
| Token refresh HTTP call | Raw fetch to Google token endpoint | `arctic` `refreshAccessToken()` | Handles error parsing, token typing, expiry extraction |
| ID token claims extraction | Manual base64 decode | `arctic` `decodeIdToken()` | Validates structure, correct claim names |
| DB migrations | Hand-written SQL files | `drizzle-kit generate` + `drizzle-kit migrate` | Type-safe, diff-based, reversible |

**Key insight:** The OAuth layer has many failure modes that are invisible until production (refresh token limits, PKCE verification failures, clock skew on expiry checks). Using Arctic handles all of them correctly.

---

## Common Pitfalls

### Pitfall 1: Testing Mode Refresh Token Expiry
**What goes wrong:** Users who sign in during development/staging (while the OAuth app is in Testing mode) get refresh tokens that expire after 7 days. The app then silently fails to refresh and users see reconnection prompts.
**Why it happens:** Google enforces a 7-day TTL on refresh tokens for unverified/testing-mode apps. This is intentional.
**How to avoid:** Publish the OAuth consent screen to Production in Google Cloud Console before the first external user signs in. This requires a brief review for sensitive scopes (calendar access).
**Warning signs:** Users consistently need to reconnect ~7 days after initial sign-in.

### Pitfall 2: Missing Refresh Token on Second Sign-In
**What goes wrong:** `tokens.hasRefreshToken()` returns `false` on the callback for a returning user, so no refresh token is stored. Later, token refresh fails with no refresh token available.
**Why it happens:** Google only returns a refresh token on the first authorization. Subsequent authorizations (same user, same app) return only an access token.
**How to avoid:** On callback, preserve the existing encrypted refresh token if the new callback doesn't include one (upsert: update access token + expiry, keep existing refresh token row). Only overwrite refresh token if a new one arrived.
**Warning signs:** `encryptedRefreshToken` becomes null in DB for returning users.

### Pitfall 3: `prompt=consent` Refresh Token Limit
**What goes wrong:** Setting `prompt=consent` on every login causes Google to issue a new refresh token each time. After 100 logins, the oldest tokens are silently revoked.
**Why it happens:** Google enforces a per-account-per-client limit of 100 refresh tokens.
**How to avoid:** Only set `prompt=consent` when re-authorization is explicitly needed (user revoked access, refresh token is missing or expired). Normal logins should not force consent.
**Warning signs:** Oldest users' sessions suddenly stop working after ~100 sign-ins.

### Pitfall 4: School Google Workspace OAuth Blocked
**What goes wrong:** When a student attempts to link their school account, the OAuth flow redirects to Google but the institution's Workspace admin has blocked third-party OAuth apps. The user sees a Google-generated error page, not the app's UI.
**Why it happens:** Google Workspace for Education admins can restrict which OAuth apps can access their domain. This is common in K-12 and university IT environments.
**How to avoid:** The callback route should handle `error=access_denied` query param gracefully and redirect to a page showing the "Access Denied" state with "Try again" and "Skip for now" buttons. The error message should mention that Canvas ICS sync still works without school account.
**Warning signs:** Callback receives `?error=access_denied` or similar.

### Pitfall 5: Cookie Overflow with Token Storage
**What goes wrong:** If tokens are stored in the session cookie rather than the database, two full Google token sets (each ~1-2 KB) exceed the 4 KB cookie limit. The browser silently drops the oversized cookie.
**Why it happens:** Browser enforces 4 KB per cookie.
**How to avoid:** Store only `userId` (and optionally session expiry) in the cookie. All tokens live in the DB.
**Warning signs:** Auth works in dev (small data) but fails in prod after second account is linked.

### Pitfall 6: Race Condition on Concurrent Token Refresh
**What goes wrong:** Two simultaneous API calls both detect an expired token and both call `refreshAccessToken()`. Google invalidates the first call's refresh token upon the second call's use. One call succeeds; the other gets an `invalid_grant` error and the user must reconnect.
**Why it happens:** Google's refresh token rotation for some account types invalidates the old token immediately upon use.
**How to avoid:** Use a DB-level optimistic lock or a simple "refresh in progress" flag in the token row. The recommended approach for this app's scale (single user, low concurrency) is to check expiry conservatively (5 minutes buffer) and accept rare double-refresh as a minor reconnect prompt rather than implementing a full lock.
**Warning signs:** Occasional `invalid_grant` errors in logs.

---

## Code Examples

### Neon + Drizzle DB Client

```typescript
// Source: https://orm.drizzle.team/docs/connect-neon
// lib/db/index.ts
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

### Drizzle Config

```typescript
// drizzle.config.ts (project root)
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### School Account Link Route (Authenticated)

```typescript
// app/link/school-google/route.ts
// Runs ONLY when user already has a personal session
import { getSession } from "@/lib/session";
import { googleClient } from "@/lib/auth";
import { generateState, generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const scopes = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.readonly"];

  const url = googleClient.createAuthorizationURL(state, codeVerifier, scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account"); // let user pick their school account

  const cookieStore = await cookies();
  cookieStore.set("link_oauth_state", state, { httpOnly: true, secure: true, maxAge: 600, sameSite: "lax" });
  cookieStore.set("link_code_verifier", codeVerifier, { httpOnly: true, secure: true, maxAge: 600, sameSite: "lax" });

  return Response.redirect(url);
}
```

### Scopes Required

| Scope | Required For |
|-------|-------------|
| `openid` | ID token issuance (decodeIdToken) |
| `email` | User email claim in ID token |
| `profile` | Name claim in ID token |
| `https://www.googleapis.com/auth/calendar` | Read + write personal calendar (Canvas sync target) |
| `https://www.googleapis.com/auth/calendar.readonly` | Read school calendar (mirror source, read-only) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth / Auth.js for all OAuth | Arctic (raw OAuth) + jose (session) | Decided at project init | Full control over dual-account session; no library-imposed session model constraints |
| Tokens in session cookie | Tokens in DB, only session ID in cookie | Decided at project init | Survives 4 KB cookie limit; enables per-user multi-account token storage |
| `googleapis` client with raw access token string (current `gcalSync.ts`) | `googleapis` client fed tokens from DB via `getFreshAccessToken()` | Phase 1 refactor | `SyncOptions.accessToken` field replaced with DB lookup; existing sync logic unchanged |
| Testing mode OAuth (current state) | Production-published OAuth app | Before first external user | Refresh tokens persist indefinitely (until revoke), not 7-day TTL |

**Deprecated/outdated in this project:**
- `CalendarSetup.tsx` token paste input (`setAccessToken` state): will be removed entirely; replaced by OAuth button flow
- `SyncOptions.accessToken` raw string param: will be replaced with `userId` + DB token lookup

---

## Open Questions

1. **`gcalSync.ts` refactor scope**
   - What we know: `gcalSync.ts` currently takes a raw `accessToken` string. Phase 1 must refactor its `SyncOptions` interface to accept `userId` + `role` instead, and internally call `getFreshAccessToken()`.
   - What's unclear: Whether the refactor is in-scope for Phase 1 or Phase 2. CONTEXT.md mentions it as an integration point but Phase 1's success criteria focus on auth only — no actual sync calls are made.
   - Recommendation: Refactor the interface signature in Phase 1 (breaking change is cheap now) but do not wire up actual sync calls until Phase 2. Stubs keep the build green.

2. **Canvas ICS URL storage (wizard step 3)**
   - What we know: The wizard has 3 steps: personal Google, school Google, Canvas ICS URL. The Canvas URL needs to be saved somewhere.
   - What's unclear: Whether `canvasIcsUrl` lives on the `users` table (simpler, decided in schema above) or in a separate table.
   - Recommendation: Store `canvasIcsUrl` as a nullable column on `users` for Phase 1 simplicity. Migrate to separate table if multi-feed support is added in v2.

3. **Google Cloud OAuth App Verification timeline**
   - What we know: Calendar scope is a "sensitive" scope. Publishing to Production requires Google verification review, which can take 1-14 days.
   - What's unclear: Whether the review is already underway or needs to be initiated.
   - Recommendation: Submit for verification early in Phase 1. In the interim, add test users manually to the OAuth consent screen (allows up to 100 test users without 7-day TTL restriction, per Google's updated policy for invited test users vs. general testing mode).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + jest-environment-jsdom + @testing-library/react |
| Config file | `jest.config.js` (exists at project root) |
| Quick run command | `npx jest --testPathPattern="auth" --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `encryptSession` + `decryptSession` round-trip; valid session returns userId | unit | `npx jest src/lib/__tests__/session.test.ts -x` | Wave 0 |
| AUTH-01 | `encryptToken` + `decryptToken` round-trip; tampered ciphertext throws | unit | `npx jest src/lib/__tests__/tokens.test.ts -x` | Wave 0 |
| AUTH-02 | School callback route stores role="school" row, does not create new user | unit/integration | `npx jest src/app/link/__tests__/school-callback.test.ts -x` | Wave 0 |
| AUTH-03 | DB schema: `oauth_tokens` unique constraint on (userId, role) enforced | unit | `npx jest src/lib/db/__tests__/schema.test.ts -x` | Wave 0 |
| AUTH-04 | `getFreshAccessToken`: uses cached token when not expired; calls `refreshAccessToken` when expired; updates DB row | unit (mock `arctic`) | `npx jest src/lib/__tests__/tokens.test.ts -x` | Wave 0 |
| AUTH-04 | `getFreshAccessToken` returns null when refresh fails; does not throw | unit | same file | Wave 0 |

Note: Route handler tests (callback flows) require mocking `arctic`, `next/headers`, and the DB client. Unit tests on `session.ts` and `tokens.ts` are pure functions and need no mocks — these are the highest-value tests.

Browser-level OAuth redirect testing (click "Sign in with Google" → redirect → callback) is **manual-only** — it requires live Google OAuth credentials and cannot be meaningfully automated in CI without a test Google account setup.

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="(session|tokens)" --passWithNoTests`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/__tests__/session.test.ts` — covers AUTH-01 (session encrypt/decrypt)
- [ ] `src/lib/__tests__/tokens.test.ts` — covers AUTH-01 (token encrypt/decrypt), AUTH-04 (refresh logic)
- [ ] `src/lib/db/__tests__/schema.test.ts` — covers AUTH-03 (schema structure validation)
- [ ] `src/app/link/__tests__/school-callback.test.ts` — covers AUTH-02 (account linking)
- [ ] `drizzle/` migrations directory — generated by `npx drizzle-kit generate`
- [ ] Framework already installed (`jest`, `@testing-library/react`, `ts-jest` in devDependencies)

---

## Sources

### Primary (HIGH confidence)

- `https://arcticjs.dev/providers/google` — Arctic v3 Google provider: initialization, auth URL, token exchange, refresh, decodeIdToken
- `https://arcticjs.dev/` — Arctic v3 overview: version, features, OAuth 2.0 authorization code only
- `https://lucia-auth.com/tutorials/google-oauth/nextjs` — Canonical Arctic + Next.js App Router integration pattern (file structure, callback route, session management)
- `https://lucia-next.pages.dev/sessions/basic-api/drizzle-orm` — Drizzle ORM session schema (pgTable, hashed session ID, 30-day TTL, rolling refresh)
- `https://orm.drizzle.team/docs/connect-neon` — Neon + Drizzle installation and HTTP driver setup
- `https://orm.drizzle.team/docs/column-types/pg` — Drizzle pgTable column types: text, timestamp, serial, boolean, jsonb
- `https://nextjs.org/docs/pages/building-your-application/authentication` — Official Next.js auth guidance: jose session encryption, middleware pattern, DAL, cookie setup
- `https://developers.google.com/identity/protocols/oauth2/web-server` — Google OAuth Web Server flow: scopes, offline access, token refresh endpoint, authorization parameters
- `https://support.google.com/cloud/answer/15549945` — Google Testing mode 7-day refresh token expiry (confirmed: affects all testing-mode apps requesting sensitive scopes)

### Secondary (MEDIUM confidence)

- Community search results confirming: `prompt=consent` 100 refresh token limit per account per client (multiple Google Groups threads)
- `https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass` — CVE-2025-29927 middleware bypass: confirms middleware alone is insufficient for auth; must verify at data access layer

### Tertiary (LOW confidence)

- WebSearch results on AES-256-GCM pattern for Node.js crypto: confirmed consistent across multiple sources but no single authoritative security audit cited

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs and official tutorial; versions from package registry
- Architecture: HIGH — patterns verified against official Arctic tutorial (lucia-auth.com) and Next.js official auth guide
- Pitfalls: HIGH — testing mode expiry, refresh token limits, cookie overflow confirmed via official Google documentation and Google Groups; school Workspace restriction confirmed via Google Workspace admin docs
- DB schema: HIGH — derived from lucia-next session pattern + Drizzle official column type docs
- Token encryption: MEDIUM — AES-256-GCM via Node.js crypto is widely documented but no single authoritative "this is the one true pattern" source

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (Arctic and Drizzle APIs are stable; Google OAuth policies are stable; re-verify if Arctic v4 is released)

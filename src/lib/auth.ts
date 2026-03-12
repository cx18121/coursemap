import { Google, generateState, generateCodeVerifier } from "arctic";

// Re-export arctic helpers for convenience in route handlers
export { generateState, generateCodeVerifier };

// Personal Google OAuth client — redirect URI points to /login/google/callback
export const googleClient = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/login/google/callback`
);

// School Google OAuth client — different redirect URI to distinguish the two flows
export const googleSchoolClient = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/link/school-google/callback`
);

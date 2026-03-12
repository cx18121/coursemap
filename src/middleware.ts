import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/session";

// Paths that do not require authentication
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/login/google",
  "/login/google/callback",
  "/link/school-google",
  "/link/school-google/callback",
];

/**
 * Optimistic session middleware.
 *
 * WARNING: This is an optimistic check only — do NOT rely on this alone for
 * sensitive API routes. This middleware reads the session JWT from the cookie
 * and verifies its signature, but does NOT check a revocation list.
 * Per CVE-2025-29927: Next.js middleware-only auth can be bypassed via the
 * x-middleware-subrequest header in older versions.
 * Sensitive route handlers should also verify the session server-side.
 *
 * Logic:
 *  - Non-public path without valid session → redirect to /
 *  - /login with valid session → redirect to /dashboard
 *  - Otherwise → pass through
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Check if this is a public path
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Read session cookie
  const sessionToken = request.cookies.get("session")?.value ?? null;
  const session = sessionToken ? await decryptSession(sessionToken) : null;
  const isAuthenticated = session !== null;

  // Redirect authenticated users away from /login to /dashboard
  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected paths to /
  if (!isPublicPath && !isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes (handled server-side with their own session checks)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};

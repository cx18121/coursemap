import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleClient, generateState, generateCodeVerifier } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Create authorization URL with required scopes
  const url = googleClient.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
  ]);

  // Request offline access (refresh token) without forcing consent every time
  url.searchParams.set("access_type", "offline");
  // Do NOT set prompt=consent — only force consent when we need a new refresh token
  // (per Pitfall 3: forcing consent every login degrades UX)

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  // Store state and codeVerifier in short-lived httpOnly cookies
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set("code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 60 * 10,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(url.toString());
}

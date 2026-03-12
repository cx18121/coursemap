import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { googleSchoolClient, generateState, generateCodeVerifier } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Create authorization URL with read-only calendar scope for school account
  const url = googleSchoolClient.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
  ]);

  // Offline access + prompt to select account (let user pick their school account)
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  // Use "link_" prefix to avoid collision with personal login cookies
  cookieStore.set("link_oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set("link_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 60 * 10,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(url.toString());
}

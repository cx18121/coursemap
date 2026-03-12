import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeIdToken } from "arctic";
import { googleSchoolClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { encryptToken } from "@/lib/tokens";
import { getSession } from "@/lib/session";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors (e.g., school Workspace blocked the OAuth request — Pitfall 4)
  if (error) {
    return NextResponse.redirect(
      new URL("/?error=school_access_denied", request.url)
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("link_oauth_state")?.value;
  const storedCodeVerifier = cookieStore.get("link_code_verifier")?.value;

  // Validate state and required params
  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  // Require authenticated session to link a school account
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let tokens;
  try {
    tokens = await googleSchoolClient.validateAuthorizationCode(
      code,
      storedCodeVerifier
    );
  } catch {
    return NextResponse.redirect(
      new URL("/?error=school_token_exchange_failed", request.url)
    );
  }

  // Extract school email from the ID token
  const claims = decodeIdToken(tokens.idToken()) as {
    sub: string;
    email: string;
    name: string;
  };
  const { email: schoolEmail } = claims;

  // Build encrypted token values
  const encryptedAccessToken = encryptToken(tokens.accessToken());
  const accessTokenExpiresAt = tokens.accessTokenExpiresAt();

  // Preserve existing refresh token if Google didn't return a new one (Pitfall 2)
  let encryptedRefreshToken: string | null = null;
  if (tokens.hasRefreshToken()) {
    encryptedRefreshToken = encryptToken(tokens.refreshToken());
  } else {
    const existing = await db.query.oauthTokens.findFirst({
      where: and(
        eq(oauthTokens.userId, session.userId),
        eq(oauthTokens.role, "school")
      ),
    });
    encryptedRefreshToken = existing?.encryptedRefreshToken ?? null;
  }

  // Insert/update school token row — does NOT create a new user row
  await db
    .insert(oauthTokens)
    .values({
      userId: session.userId,
      role: "school",
      email: schoolEmail,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.role],
      set: {
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt,
        email: schoolEmail,
        updatedAt: new Date(),
      },
    });

  // Clean up link cookies
  cookieStore.delete("link_oauth_state");
  cookieStore.delete("link_code_verifier");

  return NextResponse.redirect(new URL("/", request.url));
}

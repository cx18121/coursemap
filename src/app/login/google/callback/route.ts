import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeIdToken } from "arctic";
import { googleClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { encryptToken } from "@/lib/tokens";
import { setSessionCookie } from "@/lib/session";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors (e.g., user denied consent)
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=access_denied`, request.url)
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const storedCodeVerifier = cookieStore.get("code_verifier")?.value;

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

  let tokens;
  try {
    tokens = await googleClient.validateAuthorizationCode(
      code,
      storedCodeVerifier
    );
  } catch {
    return NextResponse.redirect(
      new URL("/?error=token_exchange_failed", request.url)
    );
  }

  // Extract user info from the ID token
  const claims = decodeIdToken(tokens.idToken()) as {
    sub: string;
    email: string;
    name: string;
  };
  const { sub: googleId, email, name } = claims;

  // Upsert user: find by googleId or insert new
  let user = await db.query.users.findFirst({
    where: eq(users.googleId, googleId),
  });

  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ googleId, email, name })
      .returning();
    user = inserted[0];
  }

  // Determine the refresh token to store
  // CRITICAL per Pitfall 2: preserve existing refresh token if Google didn't return a new one
  const encryptedAccessToken = encryptToken(tokens.accessToken());
  const accessTokenExpiresAt = tokens.accessTokenExpiresAt();

  let encryptedRefreshToken: string | null = null;
  if (tokens.hasRefreshToken()) {
    encryptedRefreshToken = encryptToken(tokens.refreshToken());
  } else {
    // Check if an existing refresh token exists in DB — preserve it
    const existing = await db.query.oauthTokens.findFirst({
      where: and(
        eq(oauthTokens.userId, user.id),
        eq(oauthTokens.role, "personal")
      ),
    });
    encryptedRefreshToken = existing?.encryptedRefreshToken ?? null;
  }

  // Upsert the personal token row
  await db
    .insert(oauthTokens)
    .values({
      userId: user.id,
      role: "personal",
      email,
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
        email,
        updatedAt: new Date(),
      },
    });

  // Set session cookie
  await setSessionCookie(user.id);

  // Clean up OAuth cookies
  cookieStore.delete("oauth_state");
  cookieStore.delete("code_verifier");

  return NextResponse.redirect(new URL("/", request.url));
}

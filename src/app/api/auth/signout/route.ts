import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/session";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Delete all OAuth tokens for this user
  await db.delete(oauthTokens).where(eq(oauthTokens.userId, session.userId));

  // Delete the user row (cascade also cleans tokens, but explicit is clearer)
  await db.delete(users).where(eq(users.id, session.userId));

  // Clear the session cookie
  await clearSessionCookie();

  // Return 200 — client-side code handles redirect to setup wizard
  return NextResponse.json({ success: true });
}

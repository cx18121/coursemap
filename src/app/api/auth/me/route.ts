import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getFreshAccessToken } from "@/lib/tokens";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user record
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch all oauth token rows for this user
  const tokenRows = await db.query.oauthTokens.findMany({
    where: eq(oauthTokens.userId, session.userId),
  });

  // Build accounts array with reconnect detection
  const accounts = await Promise.all(
    tokenRows.map(async (row) => {
      const freshToken = await getFreshAccessToken(
        session.userId,
        row.role as "personal" | "school"
      );
      return {
        role: row.role,
        email: row.email,
        connected: true,
        reconnectNeeded: freshToken === null,
      };
    })
  );

  // setupComplete = personal account connected AND canvasIcsUrl is set
  const personalConnected = accounts.some((a) => a.role === "personal");
  const setupComplete = personalConnected && user.canvasIcsUrl !== null;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      canvasIcsUrl: user.canvasIcsUrl,
    },
    accounts,
    setupComplete,
  });
}

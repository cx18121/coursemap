import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { canvasIcsUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { canvasIcsUrl } = body;

  if (typeof canvasIcsUrl !== "string" || !canvasIcsUrl.trim()) {
    return NextResponse.json(
      { error: "canvasIcsUrl is required" },
      { status: 400 }
    );
  }

  const url = canvasIcsUrl.trim();

  if (!isValidUrl(url)) {
    return NextResponse.json(
      { error: "Invalid URL format. Must be a valid http or https URL." },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ canvasIcsUrl: url })
    .where(eq(users.id, session.userId));

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { courseTypeSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/user-settings
// Returns per-course type settings for the current user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db.query.courseTypeSettings.findMany({
    where: eq(courseTypeSettings.userId, session.userId),
    columns: {
      courseName: true,
      eventType: true,
      enabled: true,
      colorId: true,
    },
  });

  return NextResponse.json({ courseTypeSettings: rows });
}

interface UserSettingsBody {
  courseName?: string;
  eventType?: string;
  enabled?: boolean;
  colorId?: string;
}

const VALID_COLOR_IDS = new Set(['1','2','3','4','5','6','7','8','9','10','11']);

// PATCH /api/user-settings
// Updates enabled and/or colorId for a specific (courseName, eventType) pair.
// At least one of enabled or colorId must be provided.
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: UserSettingsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { courseName, eventType, enabled, colorId } = body;

  if (typeof courseName !== 'string' || courseName.trim() === '') {
    return NextResponse.json({ error: 'courseName must be a non-empty string' }, { status: 400 });
  }
  if (typeof eventType !== 'string' || eventType.trim() === '') {
    return NextResponse.json({ error: 'eventType must be a non-empty string' }, { status: 400 });
  }
  if (enabled === undefined && colorId === undefined) {
    return NextResponse.json({ error: 'At least one of enabled or colorId must be provided' }, { status: 400 });
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }
  if (colorId !== undefined && !VALID_COLOR_IDS.has(colorId)) {
    return NextResponse.json({ error: 'colorId must be one of 1-11' }, { status: 400 });
  }

  // Build the set of columns to update
  const setClause: Partial<{ enabled: boolean; colorId: string }> = {};
  if (enabled !== undefined) setClause.enabled = enabled;
  if (colorId !== undefined) setClause.colorId = colorId;

  // Upsert: update if row exists, insert with defaults if not
  await db
    .insert(courseTypeSettings)
    .values({
      userId: session.userId,
      courseName,
      eventType,
      enabled: enabled ?? true,
      colorId: colorId ?? '1',
    })
    .onConflictDoUpdate({
      target: [courseTypeSettings.userId, courseTypeSettings.courseName, courseTypeSettings.eventType],
      set: setClause,
    });

  return NextResponse.json({ success: true });
}

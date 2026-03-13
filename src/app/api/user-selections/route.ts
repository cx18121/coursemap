import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { courseSelections, eventOverrides } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/user-selections
// Returns all courseSelections and eventOverrides for the session user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.userId;

  const [userCourseSelections, userEventOverrides] = await Promise.all([
    db.query.courseSelections.findMany({
      where: eq(courseSelections.userId, userId),
    }),
    db.query.eventOverrides.findMany({
      where: eq(eventOverrides.userId, userId),
    }),
  ]);

  return NextResponse.json({
    courseSelections: userCourseSelections,
    eventOverrides: userEventOverrides,
  });
}

interface CourseSelectionUpdate {
  courseName: string;
  enabled?: boolean;
  colorId?: string;
}

interface EventOverrideUpdate {
  eventUid: string;
  enabled?: boolean;
  customTitle?: string;
}

interface SelectionsBody {
  courseSelections?: CourseSelectionUpdate[];
  eventOverrides?: EventOverrideUpdate[];
}

// PUT /api/user-selections
// Accepts batch updates to course selections and event overrides
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.userId;

  let body: SelectionsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Process course selection updates
  if (body.courseSelections && Array.isArray(body.courseSelections)) {
    for (const update of body.courseSelections) {
      if (!update.courseName || typeof update.courseName !== 'string') {
        return NextResponse.json(
          { error: 'Invalid courseName in courseSelections' },
          { status: 400 }
        );
      }

      // Validate colorId if provided — must be '1' through '11'
      if (update.colorId !== undefined) {
        const colorNum = parseInt(update.colorId, 10);
        if (isNaN(colorNum) || colorNum < 1 || colorNum > 11) {
          return NextResponse.json(
            { error: `Invalid colorId "${update.colorId}": must be between '1' and '11'` },
            { status: 400 }
          );
        }
      }

      // Build the set object with only the fields that were provided
      const setValues: Record<string, unknown> = {};
      if (update.enabled !== undefined) setValues.enabled = update.enabled;
      if (update.colorId !== undefined) setValues.colorId = update.colorId;

      await db
        .insert(courseSelections)
        .values({
          userId,
          courseName: update.courseName,
          enabled: update.enabled ?? true,
          colorId: update.colorId ?? '9',
        })
        .onConflictDoUpdate({
          target: [courseSelections.userId, courseSelections.courseName],
          set: setValues,
        });
    }
  }

  // Process event override updates
  if (body.eventOverrides && Array.isArray(body.eventOverrides)) {
    for (const update of body.eventOverrides) {
      if (!update.eventUid || typeof update.eventUid !== 'string') {
        return NextResponse.json(
          { error: 'Invalid eventUid in eventOverrides' },
          { status: 400 }
        );
      }

      // Build the set object with only the fields that were provided
      const setValues: Record<string, unknown> = {};
      if (update.enabled !== undefined) setValues.enabled = update.enabled;
      if (update.customTitle !== undefined) setValues.customTitle = update.customTitle;

      await db
        .insert(eventOverrides)
        .values({
          userId,
          eventUid: update.eventUid,
          enabled: update.enabled ?? false,
          customTitle: update.customTitle ?? null,
        })
        .onConflictDoUpdate({
          target: [eventOverrides.userId, eventOverrides.eventUid],
          set: setValues,
        });
    }
  }

  return NextResponse.json({ success: true });
}

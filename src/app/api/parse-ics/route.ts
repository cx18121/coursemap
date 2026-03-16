import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { users, courseSelections, eventOverrides } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseCanvasFeed } from '@/services/icalParser';
import { ensureCourseSelections } from '@/services/syncFilter';
import { assignCourseColors } from '@/services/colorAssignment';
import { cleanTitlesBatch } from '@/services/titleCleanup';

export async function GET() {
  try {
    // 1. Session auth — 401 if not logged in
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.userId;

    // 2. Fetch the stored canvasIcsUrl from DB
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.canvasIcsUrl) {
      return NextResponse.json(
        { error: 'No Canvas feed URL configured' },
        { status: 400 }
      );
    }

    // 3. Parse the Canvas ICS feed
    const groupedEvents = await parseCanvasFeed(user.canvasIcsUrl);
    const courseNames = Object.keys(groupedEvents);

    // 4. Upsert course selections for any new courses
    await ensureCourseSelections(userId, courseNames);

    // 5. Ensure colors are assigned to all courses
    const colorMap = await assignCourseColors(userId, courseNames);

    // 6. Clean all event titles in bulk
    const allTitles = courseNames.flatMap((courseName) =>
      groupedEvents[courseName].map((e) => e.summary)
    );
    const cleanedTitlesMap = await cleanTitlesBatch(allTitles);

    // 7. Fetch course selections and event overrides for UI state
    const [dbCourseSelections, dbEventOverrides] = await Promise.all([
      db.query.courseSelections.findMany({
        where: eq(courseSelections.userId, userId),
      }),
      db.query.eventOverrides.findMany({
        where: eq(eventOverrides.userId, userId),
      }),
    ]);

    const courseSelectionMap = new Map(
      dbCourseSelections.map((cs) => [cs.courseName, cs])
    );
    const eventOverrideMap = new Map(
      dbEventOverrides.map((eo) => [eo.eventUid, eo])
    );

    // 8. Build the response — one entry per course
    const courses = courseNames.map((courseName) => {
      const courseRow = courseSelectionMap.get(courseName);
      const colorId = courseRow?.colorId ?? colorMap[courseName] ?? '9';
      const enabled = courseRow?.enabled ?? true;

      const events = groupedEvents[courseName].map((event) => {
        const override = eventOverrideMap.get(event.uid);
        // An event is excluded only if there's an override row with enabled=false
        const excluded = override !== undefined && !override.enabled;

        return {
          uid: event.uid,
          summary: event.summary,
          cleanedTitle: cleanedTitlesMap[event.summary] ?? event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          excluded,
          eventType: event.eventType,
        };
      });

      return {
        courseName,
        colorId,
        enabled,
        events,
      };
    });

    return NextResponse.json({ courses });
  } catch (error: unknown) {
    console.error('parse-ics API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse Canvas feed';
    const status = message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

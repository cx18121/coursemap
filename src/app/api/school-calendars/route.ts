import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { schoolCalendarSelections } from '@/lib/db/schema';
import { listSchoolCalendars } from '@/services/schoolMirror';
import { getFreshAccessToken } from '@/lib/tokens';

// GET /api/school-calendars
// Lists non-system school calendars for the session user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.userId;

  // Check if school account is linked by probing for access token
  const schoolToken = await getFreshAccessToken(userId, 'school');
  if (!schoolToken) {
    return NextResponse.json({ calendars: [], linked: false });
  }

  try {
    const calendars = await listSchoolCalendars(userId);
    return NextResponse.json({ calendars, linked: true });
  } catch (error: unknown) {
    console.error('school-calendars GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list school calendars';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface SchoolCalendarToggleBody {
  calendarId: string;
  calendarName: string;
  enabled: boolean;
}

// PUT /api/school-calendars
// Toggle selection state for a school calendar
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.userId;

  let body: SchoolCalendarToggleBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { calendarId, calendarName, enabled } = body;

  if (!calendarId || typeof calendarId !== 'string') {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }
  if (!calendarName || typeof calendarName !== 'string') {
    return NextResponse.json({ error: 'calendarName is required' }, { status: 400 });
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  await db
    .insert(schoolCalendarSelections)
    .values({
      userId,
      schoolCalendarId: calendarId,
      schoolCalendarName: calendarName,
      enabled,
    })
    .onConflictDoUpdate({
      target: [schoolCalendarSelections.userId, schoolCalendarSelections.schoolCalendarId],
      set: { enabled },
    });

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/user-settings
// Returns current user settings relevant to the dashboard
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({
    syncAssignments: user.syncAssignments ?? true,
    syncQuizzes: user.syncQuizzes ?? true,
    syncDiscussions: user.syncDiscussions ?? true,
    syncEvents: user.syncEvents ?? true,
  });
}

interface UserSettingsBody {
  syncAssignments?: boolean;
  syncQuizzes?: boolean;
  syncDiscussions?: boolean;
  syncEvents?: boolean;
}

// PATCH /api/user-settings
// Accepts per-type sync toggles and persists to users table
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

  const updates: Partial<typeof users.$inferInsert> = {};

  if (body.syncAssignments !== undefined) {
    if (typeof body.syncAssignments !== 'boolean') {
      return NextResponse.json({ error: 'syncAssignments must be a boolean' }, { status: 400 });
    }
    updates.syncAssignments = body.syncAssignments;
  }
  if (body.syncQuizzes !== undefined) {
    if (typeof body.syncQuizzes !== 'boolean') {
      return NextResponse.json({ error: 'syncQuizzes must be a boolean' }, { status: 400 });
    }
    updates.syncQuizzes = body.syncQuizzes;
  }
  if (body.syncDiscussions !== undefined) {
    if (typeof body.syncDiscussions !== 'boolean') {
      return NextResponse.json({ error: 'syncDiscussions must be a boolean' }, { status: 400 });
    }
    updates.syncDiscussions = body.syncDiscussions;
  }
  if (body.syncEvents !== undefined) {
    if (typeof body.syncEvents !== 'boolean') {
      return NextResponse.json({ error: 'syncEvents must be a boolean' }, { status: 400 });
    }
    updates.syncEvents = body.syncEvents;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.userId));

  return NextResponse.json({ success: true });
}

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
    typeGroupingEnabled: user.typeGroupingEnabled ?? false,
  });
}

interface UserSettingsBody {
  typeGroupingEnabled?: boolean;
}

// PATCH /api/user-settings
// Accepts { typeGroupingEnabled: boolean } and persists to users table
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

  if (body.typeGroupingEnabled === undefined || typeof body.typeGroupingEnabled !== 'boolean') {
    return NextResponse.json(
      { error: 'typeGroupingEnabled must be a boolean' },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ typeGroupingEnabled: body.typeGroupingEnabled })
    .where(eq(users.id, session.userId));

  return NextResponse.json({ success: true });
}

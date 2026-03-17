import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { syncLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log = await db.query.syncLog.findFirst({
    where: eq(syncLog.userId, session.userId),
  });

  return NextResponse.json({
    lastSyncedAt: log?.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: log?.lastSyncStatus ?? null,
    lastSyncError: log?.lastSyncError ?? null,
  });
}

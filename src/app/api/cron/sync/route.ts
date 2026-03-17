import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';
import { runSyncForUser, upsertSyncLog } from '@/lib/syncRunner';
import { classifyError } from '@/app/api/sync/route';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only sync users who have a Canvas ICS URL configured
  const allUsers = await db
    .select({ id: users.id, canvasIcsUrl: users.canvasIcsUrl })
    .from(users)
    .where(isNotNull(users.canvasIcsUrl));

  const results: { userId: number; status: string; error?: string }[] = [];

  for (const user of allUsers) {
    try {
      await runSyncForUser(user.id, user.canvasIcsUrl!);
      await upsertSyncLog(user.id, 'success');
      results.push({ userId: user.id, status: 'success' });
    } catch (err) {
      const errorMsg = classifyError(err);
      await upsertSyncLog(user.id, 'error', errorMsg);
      results.push({ userId: user.id, status: 'error', error: errorMsg });
    }
  }

  return Response.json({ ran: results.length, results });
}

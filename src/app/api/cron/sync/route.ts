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

  const CONCURRENCY = 5;
  const results: { userId: number; status: string; error?: string }[] = [];

  for (let i = 0; i < allUsers.length; i += CONCURRENCY) {
    const batch = allUsers.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (user) => {
        await runSyncForUser(user.id, user.canvasIcsUrl!);
        await upsertSyncLog(user.id, 'success');
        return { userId: user.id, status: 'success' as const };
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const errorMsg = classifyError(result.reason);
        await upsertSyncLog(batch[j].id, 'error', errorMsg);
        results.push({ userId: batch[j].id, status: 'error', error: errorMsg });
      }
    }
  }

  return Response.json({ ran: results.length, results });
}

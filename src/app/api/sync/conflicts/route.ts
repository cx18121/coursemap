import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { syncedEvents } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getFreshAccessToken } from '@/lib/tokens';
import { google } from 'googleapis';

const GRACE_MS = 60_000; // 60 seconds — suppresses false positives from sync-triggered updated bumps
const BATCH_SIZE = 10;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load only rows with a known GCal event ID — rows without gcalEventId are skipped
  const rows = await db.query.syncedEvents.findMany({
    where: and(
      eq(syncedEvents.userId, session.userId),
      isNotNull(syncedEvents.gcalEventId),
    ),
  });

  if (rows.length === 0) {
    return NextResponse.json({ conflictCount: 0, conflicts: [] });
  }

  const accessToken = await getFreshAccessToken(session.userId, 'personal');
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const conflicts: Array<{ uid: string; summary: string; startAt: string; gcalUpdatedAt: string }> = [];

  // Batch events.get calls in groups of BATCH_SIZE to avoid quota exhaustion
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        if (!row.gcalEventId) return; // defensive: skip rows that slipped through the WHERE filter
        try {
          const gcalEvent = await calendar.events.get({
            calendarId: row.gcalCalendarId,
            eventId: row.gcalEventId,
          });
          const gcalUpdated = gcalEvent.data.updated;
          if (!gcalUpdated) return;
          const updatedMs = new Date(gcalUpdated).getTime();
          const syncedMs = row.syncedAt.getTime();
          if (updatedMs > syncedMs + GRACE_MS) {
            conflicts.push({
              uid: row.uid,
              summary: row.summary,
              startAt: row.startAt.toISOString(),
              gcalUpdatedAt: gcalUpdated,
            });
          }
        } catch {
          // Deleted or inaccessible event — not counted as a conflict
        }
      })
    );
  }

  return NextResponse.json({ conflictCount: conflicts.length, conflicts });
}

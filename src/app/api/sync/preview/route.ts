import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { users, syncedEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseCanvasFeed, type CanvasEvent } from '@/services/icalParser';
import { filterEventsForSync } from '@/services/syncFilter';
import { loadCourseTypeSettings } from '@/services/gcalSync';

interface SyncedEventSnapshot {
  summary: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
}

/**
 * Compares a Canvas event against a syncedEvents DB snapshot.
 * Returns true if any field has changed since the last sync.
 * CanvasEvent.start and .end are Date objects.
 */
function hasChangedVsSnapshot(
  incoming: CanvasEvent,
  snapshot: SyncedEventSnapshot
): boolean {
  if (incoming.summary !== snapshot.summary) return true;
  if ((incoming.description ?? null) !== (snapshot.description ?? null)) return true;
  if (incoming.start.getTime() !== snapshot.startAt.getTime()) return true;
  if (incoming.end.getTime() !== snapshot.endAt.getTime()) return true;
  return false;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user?.canvasIcsUrl) {
    return NextResponse.json({ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 0 });
  }

  // Parse current Canvas feed
  const groupedEvents = await parseCanvasFeed(user.canvasIcsUrl);

  // Apply course-level and event-level filters (same as real sync)
  const filteredEvents = await filterEventsForSync(session.userId, groupedEvents);

  // Apply per-type filters (same as real sync — Pitfall 6 in RESEARCH.md)
  const settingsMap = await loadCourseTypeSettings(session.userId);
  const typeFilteredEvents = filteredEvents.filter((event) => {
    const typeSetting = settingsMap.get(event.courseName)?.get(event.eventType);
    // Default to enabled if no setting exists (same as isTypeEnabled in gcalSync.ts)
    return typeSetting?.enabled ?? true;
  });

  // Load DB mirror — one query, zero GCal API calls
  const mirror = await db.query.syncedEvents.findMany({
    where: eq(syncedEvents.userId, session.userId),
  });
  const mirrorByUid = new Map(mirror.map((r) => [r.uid, r]));

  let wouldCreate = 0;
  let wouldUpdate = 0;
  let wouldSkip = 0;

  for (const event of typeFilteredEvents) {
    const existing = mirrorByUid.get(event.uid);
    if (!existing) {
      wouldCreate++;
    } else if (hasChangedVsSnapshot(event, existing)) {
      wouldUpdate++;
    } else {
      wouldSkip++;
    }
  }

  return NextResponse.json({ wouldCreate, wouldUpdate, wouldSkip });
}

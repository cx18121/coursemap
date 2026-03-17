import { parseCanvasFeed } from '@/services/icalParser';
import { filterEventsForSync } from '@/services/syncFilter';
import { assignCourseColors } from '@/services/colorAssignment';
import { syncCanvasEvents, type SyncSummary } from '@/services/gcalSync';
import { mirrorSchoolCalendars, type MirrorSummary } from '@/services/schoolMirror';
import { db } from '@/lib/db';
import { syncLog } from '@/lib/db/schema';

/**
 * Executes the 5-step sync pipeline for a single user without progress tracking.
 * Used by the cron route where per-event progress callbacks are not needed.
 */
export async function runSyncForUser(
  userId: number,
  canvasIcsUrl: string
): Promise<{ canvasSummary: SyncSummary; mirrorSummary: MirrorSummary }> {
  // Step 1: Parse Canvas feed (includes AI classification of event types)
  const groupedEvents = await parseCanvasFeed(canvasIcsUrl);
  const courseNames = Object.keys(groupedEvents);

  // Step 2: Filter events by user selections
  const filteredEvents = await filterEventsForSync(userId, groupedEvents);

  // Step 3: Get color map for the courses
  const colorMap = await assignCourseColors(userId, courseNames);

  // Step 4: Sync Canvas events to Google Calendar (no-op progress callback)
  const canvasSummary = await syncCanvasEvents(userId, filteredEvents, colorMap, () => {});

  // Step 5: Mirror school calendars (no-op progress callback)
  const mirrorSummary = await mirrorSchoolCalendars(userId, () => {});

  return { canvasSummary, mirrorSummary };
}

/**
 * Upserts a syncLog row for the given user.
 * One row per user (userId has a unique constraint); uses onConflictDoUpdate.
 */
export async function upsertSyncLog(
  userId: number,
  status: 'success' | 'error',
  error?: string | null
): Promise<void> {
  await db
    .insert(syncLog)
    .values({
      userId,
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: error ?? null,
    })
    .onConflictDoUpdate({
      target: syncLog.userId,
      set: {
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error ?? null,
      },
    });
}

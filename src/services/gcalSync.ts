/**
 * gcalSync.ts
 * Refactored sync engine with bulk dedup and per-course sub-calendar targeting.
 *
 * Key improvements over the old implementation:
 * - Replaces per-event events.list dedup (N API calls) with single bulk fetch per sub-calendar (1 call)
 * - Gets access token internally via getFreshAccessToken — no raw token in function signature
 * - Creates one sub-calendar per (Canvas course, event type) via gcalSubcalendars.ts helper
 * - Sets color at sub-calendar level only (not on individual events)
 * - Returns SyncSummary with accurate counts and error messages
 * - Type grouping is ALWAYS ON: events are routed to per-(course, type) sub-calendars
 * - Per-course per-type filters: events of disabled types for a course are skipped
 * - Per-type settings are loaded from courseTypeSettings DB table
 */

import { google, calendar_v3 } from 'googleapis';
import { eq, and } from 'drizzle-orm';
import { CanvasEvent } from './icalParser';
import { getFreshAccessToken } from '@/lib/tokens';
import { ensureTypeSubCalendar } from './gcalSubcalendars';
import { db } from '@/lib/db';
import { courseTypeSettings, syncedEvents } from '@/lib/db/schema';

/**
 * Default color IDs for each event type.
 * Mirrors TYPE_COLOR_MAP in gcalSubcalendars.ts — duplicated here for use
 * when inserting new courseTypeSettings rows (no import cycle needed).
 */
const TYPE_COLOR_MAP: Record<string, string> = {
  Assignments:   '9',   // Blueberry
  Quizzes:       '11',  // Tomato
  Discussions:   '2',   // Sage
  Events:        '6',   // Tangerine
  Announcements: '8',   // Graphite
  Exams:         '3',   // Grape
  Labs:          '7',   // Peacock
  Lectures:      '5',   // Banana
  Projects:      '4',   // Flamingo
};

export interface SyncProgress {
  courseName: string;
  processed: number;
  total: number;
}

export interface SyncSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Determine if an incoming Canvas event differs from the existing Google Calendar event
 * enough to require an update.
 */
function hasChanged(
  incoming: CanvasEvent,
  existing: calendar_v3.Schema$Event
): boolean {
  if (incoming.summary !== existing.summary) return true;
  if (incoming.description !== existing.description) return true;

  const incomingStart = new Date(incoming.start).toISOString();
  const existingStart = existing.start?.dateTime ?? existing.start?.date ?? '';
  if (incomingStart !== existingStart) return true;

  const incomingEnd = new Date(incoming.end).toISOString();
  const existingEnd = existing.end?.dateTime ?? existing.end?.date ?? '';
  if (incomingEnd !== existingEnd) return true;

  return false;
}

/**
 * Build the Google Calendar event request body for a Canvas event.
 * Does NOT set colorId — color is managed at the sub-calendar level.
 */
function buildGcalEvent(event: CanvasEvent): calendar_v3.Schema$Event {
  return {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: new Date(event.start).toISOString(),
    },
    end: {
      dateTime: new Date(event.end).toISOString(),
    },
    extendedProperties: {
      private: {
        canvasCanvasUid: event.uid,
        canvasSourceCalendarId: 'canvas',
        canvasCourseName: event.courseName,
      },
    },
  };
}

/** Value stored per (courseName, eventType) in the in-memory settings map. */
interface TypeSetting {
  enabled: boolean;
  colorId: string;
}

/**
 * Load per-course type settings for a user from the DB.
 * Returns a nested map: courseName -> eventType -> { enabled, colorId }
 *
 * @param userId - The user's internal DB ID
 * @returns Nested map of (courseName -> eventType -> TypeSetting)
 */
async function loadCourseTypeSettings(
  userId: number
): Promise<Map<string, Map<string, TypeSetting>>> {
  const rows = await db.query.courseTypeSettings.findMany({
    where: eq(courseTypeSettings.userId, userId),
  });

  const settingsMap = new Map<string, Map<string, TypeSetting>>();
  for (const row of rows) {
    if (!settingsMap.has(row.courseName)) {
      settingsMap.set(row.courseName, new Map());
    }
    settingsMap.get(row.courseName)!.set(row.eventType, {
      enabled: row.enabled,
      colorId: row.colorId,
    });
  }
  return settingsMap;
}

/**
 * Upsert courseTypeSettings rows for newly discovered (course, type) pairs.
 * Only inserts rows that don't already exist — defaults to enabled = true
 * and colorId from TYPE_COLOR_MAP (Lavender fallback for unknown types).
 *
 * @param userId - The user's internal DB ID
 * @param courseName - The Canvas course name
 * @param eventType - The human-readable event type label
 * @param settingsMap - Current in-memory settings map (updated in-place)
 */
async function upsertCourseTypeSetting(
  userId: number,
  courseName: string,
  eventType: string,
  settingsMap: Map<string, Map<string, TypeSetting>>
): Promise<void> {
  const courseMap = settingsMap.get(courseName);
  if (courseMap?.has(eventType)) {
    // Already in DB/memory — no action needed
    return;
  }

  const defaultColorId = TYPE_COLOR_MAP[eventType] ?? '1'; // Lavender fallback

  // Insert new row with default enabled = true and type-specific colorId
  await db.insert(courseTypeSettings).values({
    userId,
    courseName,
    eventType,
    enabled: true,
    colorId: defaultColorId,
  }).onConflictDoNothing();

  // Update in-memory map
  if (!settingsMap.has(courseName)) {
    settingsMap.set(courseName, new Map());
  }
  settingsMap.get(courseName)!.set(eventType, { enabled: true, colorId: defaultColorId });
}

/**
 * Check if an event type is enabled for a given course.
 * If no setting exists (new discovery), defaults to true.
 *
 * @param settingsMap - Per-course type settings map
 * @param courseName - The Canvas course name
 * @param eventType - The human-readable event type label
 * @returns true if the type is enabled (or no setting found)
 */
function isTypeEnabled(
  settingsMap: Map<string, Map<string, TypeSetting>>,
  courseName: string,
  eventType: string
): boolean {
  return settingsMap.get(courseName)?.get(eventType)?.enabled ?? true;
}

/**
 * Sync Canvas events to the user's personal Google Calendar.
 *
 * Events are always routed to per-(course, type) sub-calendars.
 * Per-course per-type settings are loaded from courseTypeSettings DB table.
 * New (course, type) pairs discovered during sync are auto-enabled and persisted.
 *
 * For each enabled type bucket per course:
 *  1. Upserts courseTypeSettings row if not yet tracked
 *  2. Ensures a type sub-calendar exists (creates once, caches calendarId in DB)
 *  3. Bulk-fetches all existing events from that sub-calendar in one API call
 *  4. Diffs locally: inserts new events, updates changed events, skips unchanged
 *
 * @param userId - The user's internal DB ID
 * @param events - Array of Canvas events to sync
 * @param courseColorMap - Map of course name to Google Calendar colorId (1-24)
 * @param onProgress - Optional callback invoked after each event is processed
 * @returns SyncSummary with counts of inserted/updated/skipped/failed events
 */
export async function syncCanvasEvents(
  userId: number,
  events: CanvasEvent[],
  courseColorMap: Record<string, string>,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncSummary> {
  const accessToken = await getFreshAccessToken(userId, 'personal');
  if (!accessToken) {
    throw new Error('No access token available for personal account. Please re-authenticate.');
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const summary: SyncSummary = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Load per-course type settings from DB
  const settingsMap = await loadCourseTypeSettings(userId);

  // Group events by course name
  const eventsByCourse = new Map<string, CanvasEvent[]>();
  for (const event of events) {
    const group = eventsByCourse.get(event.courseName) ?? [];
    group.push(event);
    eventsByCourse.set(event.courseName, group);
  }

  // Process each course — type grouping is always on
  for (const [courseName, courseEvents] of eventsByCourse) {
    const colorId = courseColorMap[courseName] ?? '9'; // default: Blueberry

    // Fan out to per-(course, type) sub-calendars
    const eventsByType = new Map<string, CanvasEvent[]>();
    for (const evt of courseEvents) {
      // Upsert settings for newly discovered (course, type) pairs
      await upsertCourseTypeSetting(userId, courseName, evt.eventType, settingsMap);

      // Skip events whose type is disabled for this course
      if (!isTypeEnabled(settingsMap, courseName, evt.eventType)) continue;

      const bucket = eventsByType.get(evt.eventType) ?? [];
      bucket.push(evt);
      eventsByType.set(evt.eventType, bucket);
    }

    for (const [eventType, typeEvents] of eventsByType) {
      const typeSetting = settingsMap.get(courseName)?.get(eventType);
      const typeColorId = typeSetting?.colorId ?? TYPE_COLOR_MAP[eventType] ?? '1';
      const subCalId = await ensureTypeSubCalendar(
        calendar,
        userId,
        courseName,
        eventType,
        typeColorId
      );

      // Bulk-fetch all existing Canvas events from this type sub-calendar
      const existingResponse = await calendar.events.list({
        calendarId: subCalId,
        privateExtendedProperty: ['canvasSourceCalendarId=canvas'],
        maxResults: 2500,
        singleEvents: true,
      });

      // Build UID -> existing event map for O(1) lookup
      const existingByUid = new Map<string, calendar_v3.Schema$Event>();
      for (const item of existingResponse.data.items ?? []) {
        const uid = item.extendedProperties?.private?.canvasCanvasUid;
        if (uid) existingByUid.set(uid, item);
      }

      // Diff and sync each event in this type bucket
      for (let i = 0; i < typeEvents.length; i++) {
        const event = typeEvents[i];
        const gcalEvent = buildGcalEvent(event);
        try {
          const existing = existingByUid.get(event.uid);
          if (!existing) {
            const insertResponse = await calendar.events.insert({ calendarId: subCalId, requestBody: gcalEvent });
            const gcalEventId = insertResponse.data.id ?? null;
            await db.insert(syncedEvents).values({
              userId,
              uid: event.uid,
              summary: event.summary,
              description: event.description ?? null,
              startAt: new Date(event.start),
              endAt: new Date(event.end),
              gcalCalendarId: subCalId,
              gcalEventId,
              syncedAt: new Date(),
            }).onConflictDoUpdate({
              target: [syncedEvents.userId, syncedEvents.uid],
              set: {
                summary: event.summary,
                description: event.description ?? null,
                startAt: new Date(event.start),
                endAt: new Date(event.end),
                gcalCalendarId: subCalId,
                gcalEventId,
                syncedAt: new Date(),
              },
            });
            summary.inserted++;
          } else if (hasChanged(event, existing)) {
            const gcalEventId = existing.id ?? null;
            await calendar.events.update({ calendarId: subCalId, eventId: existing.id!, requestBody: gcalEvent });
            await db.insert(syncedEvents).values({
              userId,
              uid: event.uid,
              summary: event.summary,
              description: event.description ?? null,
              startAt: new Date(event.start),
              endAt: new Date(event.end),
              gcalCalendarId: subCalId,
              gcalEventId,
              syncedAt: new Date(),
            }).onConflictDoUpdate({
              target: [syncedEvents.userId, syncedEvents.uid],
              set: {
                summary: event.summary,
                description: event.description ?? null,
                startAt: new Date(event.start),
                endAt: new Date(event.end),
                gcalCalendarId: subCalId,
                gcalEventId,
                syncedAt: new Date(),
              },
            });
            summary.updated++;
          } else {
            summary.skipped++;
          }
        } catch (err: unknown) {
          summary.failed++;
          const message = err instanceof Error ? err.message : String(err);
          summary.errors.push(`[${event.courseName}] ${event.summary}: ${message}`);
        }
        onProgress?.({ courseName, processed: i + 1, total: typeEvents.length });
      }
    }
  }

  return summary;
}

// Export for use in DB operations from other modules
export { loadCourseTypeSettings, upsertCourseTypeSetting };
export type { courseTypeSettings as CourseTypeSettingsTable };

// Re-export and helper type for settings rows
export interface CourseTypeSetting {
  courseName: string;
  eventType: string;
  enabled: boolean;
  colorId: string;
}

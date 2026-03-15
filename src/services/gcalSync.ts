/**
 * gcalSync.ts
 * Refactored sync engine with bulk dedup and per-course sub-calendar targeting.
 *
 * Key improvements over the old implementation:
 * - Replaces per-event events.list dedup (N API calls) with single bulk fetch per sub-calendar (1 call)
 * - Gets access token internally via getFreshAccessToken — no raw token in function signature
 * - Creates one sub-calendar per Canvas course via gcalSubcalendars.ts helper
 * - Sets color at sub-calendar level only (not on individual events)
 * - Returns SyncSummary with accurate counts and error messages
 * - Type grouping is ALWAYS ON: events are routed to per-(course, type) sub-calendars
 * - Per-type filters: events of disabled types are skipped (not synced)
 */

import { google, calendar_v3 } from 'googleapis';
import { CanvasEvent } from './icalParser';
import { getFreshAccessToken } from '@/lib/tokens';
import { ensureTypeSubCalendar } from './gcalSubcalendars';
import { CanvasEventType } from './eventTypeClassifier';

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

/**
 * Set of CanvasEventType values controlled by each sync toggle.
 * The 'syncEvents' toggle covers both 'event' and 'announcement' types.
 */
const TYPE_TOGGLE_MAP: Record<string, string> = {
  assignment: 'syncAssignments',
  quiz: 'syncQuizzes',
  discussion: 'syncDiscussions',
  event: 'syncEvents',
  announcement: 'syncEvents', // grouped under Events toggle
};

export interface EnabledEventTypes {
  syncAssignments: boolean;
  syncQuizzes: boolean;
  syncDiscussions: boolean;
  syncEvents: boolean;
}

/**
 * Sync Canvas events to the user's personal Google Calendar.
 *
 * Events are always routed to per-(course, type) sub-calendars.
 * Events of disabled types (per enabledEventTypes) are skipped.
 *
 * For each enabled type bucket per course:
 *  1. Ensures a type sub-calendar exists (creates once, caches calendarId in DB)
 *  2. Bulk-fetches all existing events from that sub-calendar in one API call
 *  3. Diffs locally: inserts new events, updates changed events, skips unchanged
 *
 * @param userId - The user's internal DB ID
 * @param events - Array of Canvas events to sync
 * @param courseColorMap - Map of course name to Google Calendar colorId (1-24)
 * @param onProgress - Optional callback invoked after each event is processed
 * @param enabledEventTypes - Per-type flags; all default to true if omitted
 * @returns SyncSummary with counts of inserted/updated/skipped/failed events
 */
export async function syncCanvasEvents(
  userId: number,
  events: CanvasEvent[],
  courseColorMap: Record<string, string>,
  onProgress?: (progress: SyncProgress) => void,
  enabledEventTypes?: EnabledEventTypes
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

  // Group events by course name
  const eventsByCourse = new Map<string, CanvasEvent[]>();
  for (const event of events) {
    const group = eventsByCourse.get(event.courseName) ?? [];
    group.push(event);
    eventsByCourse.set(event.courseName, group);
  }

  // Resolve enabled types (default all enabled when not provided)
  const enabled: EnabledEventTypes = {
    syncAssignments: enabledEventTypes?.syncAssignments ?? true,
    syncQuizzes: enabledEventTypes?.syncQuizzes ?? true,
    syncDiscussions: enabledEventTypes?.syncDiscussions ?? true,
    syncEvents: enabledEventTypes?.syncEvents ?? true,
  };

  // Process each course — type grouping is always on
  for (const [courseName, courseEvents] of eventsByCourse) {
    const colorId = courseColorMap[courseName] ?? '9'; // default: Blueberry

    // Fan out to per-(course, type) sub-calendars, filtering disabled types
    const eventsByType = new Map<string, CanvasEvent[]>();
    for (const evt of courseEvents) {
      const toggleKey = TYPE_TOGGLE_MAP[evt.eventType] ?? 'syncEvents';
      // Skip events whose type is disabled
      if (!enabled[toggleKey as keyof EnabledEventTypes]) continue;
      const bucket = eventsByType.get(evt.eventType) ?? [];
      bucket.push(evt);
      eventsByType.set(evt.eventType, bucket);
    }

    for (const [eventType, typeEvents] of eventsByType) {
      const subCalId = await ensureTypeSubCalendar(
        calendar,
        userId,
        courseName,
        eventType as CanvasEventType,
        colorId
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
            await calendar.events.insert({ calendarId: subCalId, requestBody: gcalEvent });
            summary.inserted++;
          } else if (hasChanged(event, existing)) {
            await calendar.events.update({ calendarId: subCalId, eventId: existing.id!, requestBody: gcalEvent });
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

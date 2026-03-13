/**
 * schoolMirror.ts
 * School Google Calendar listing and one-way mirror to personal account.
 *
 * listSchoolCalendars — fetches all calendars from the linked school Google account,
 *   filters out system calendars, and annotates each with its DB selection state.
 *
 * mirrorSchoolCalendars — for each enabled school calendar, ensures a mirror
 *   sub-calendar on the personal account, then bulk-deduplicates and copies events.
 *   School event titles are preserved as-is (no AI cleanup per locked decision).
 */

import { google, calendar_v3 } from 'googleapis';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schoolCalendarSelections } from '@/lib/db/schema';
import { getFreshAccessToken } from '@/lib/tokens';
import { ensureMirrorSubCalendar } from './gcalSubcalendars';

export interface SchoolCalendar {
  calendarId: string;
  name: string;
  selected: boolean;
}

export interface MirrorSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export type MirrorProgressCallback = (calendarName: string, processed: number, total: number) => void;

/**
 * IDs / suffixes that identify Google system calendars to exclude from listing.
 */
const SYSTEM_CALENDAR_PATTERNS = [
  '#contacts@group.v.calendar.google.com',
  '#holiday@group.v.calendar.google.com',
  '#weather@group.v.calendar.google.com',
];

function isSystemCalendar(cal: calendar_v3.Schema$CalendarListEntry): boolean {
  if (cal.accessRole === 'freeBusyReader') return true;
  const id = cal.id ?? '';
  return SYSTEM_CALENDAR_PATTERNS.some((pattern) => id.endsWith(pattern));
}

/**
 * List all non-system calendars from the user's linked school Google account.
 * Returns an empty array if no school account is linked (no token available).
 *
 * Each returned calendar has a `selected` field:
 * - true if the calendar is in DB with enabled=true, OR if it hasn't been seen before (auto-include new)
 * - false if the calendar is in DB with enabled=false
 */
export async function listSchoolCalendars(userId: number): Promise<SchoolCalendar[]> {
  const schoolToken = await getFreshAccessToken(userId, 'school');
  if (!schoolToken) {
    return [];
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: schoolToken });
  const schoolCalendar = google.calendar({ version: 'v3', auth });

  // Fetch calendarList from school account
  const { data } = await schoolCalendar.calendarList.list({
    minAccessRole: 'reader',
  });

  // Filter out system/utility calendars
  const userCalendars = (data.items ?? []).filter((cal) => !isSystemCalendar(cal));

  // Fetch DB selections for this user
  const dbSelections = await db.query.schoolCalendarSelections.findMany({
    where: eq(schoolCalendarSelections.userId, userId),
  });

  const selectionMap = new Map<string, boolean>();
  for (const row of dbSelections) {
    selectionMap.set(row.schoolCalendarId, row.enabled);
  }

  return userCalendars.map((cal) => {
    const calId = cal.id!;
    const dbSelected = selectionMap.get(calId);
    // If never seen before → default to selected (auto-include new calendars)
    const selected = dbSelected !== undefined ? dbSelected : true;
    return {
      calendarId: calId,
      name: cal.summary ?? calId,
      selected,
    };
  });
}

/**
 * Determine if a mirrored event has changed relative to the source school event.
 */
function mirrorEventChanged(
  schoolEvent: calendar_v3.Schema$Event,
  mirrorEvent: calendar_v3.Schema$Event
): boolean {
  if (schoolEvent.summary !== mirrorEvent.summary) return true;
  if ((schoolEvent.description ?? '') !== (mirrorEvent.description ?? '')) return true;

  const schoolStart = schoolEvent.start?.dateTime ?? schoolEvent.start?.date ?? '';
  const mirrorStart = mirrorEvent.start?.dateTime ?? mirrorEvent.start?.date ?? '';
  if (schoolStart !== mirrorStart) return true;

  const schoolEnd = schoolEvent.end?.dateTime ?? schoolEvent.end?.date ?? '';
  const mirrorEnd = mirrorEvent.end?.dateTime ?? mirrorEvent.end?.date ?? '';
  if (schoolEnd !== mirrorEnd) return true;

  return false;
}

/**
 * Build the request body to insert/update a mirrored school event.
 * Preserves the original school event title — no AI cleanup applied.
 */
function buildMirrorEvent(
  schoolEvent: calendar_v3.Schema$Event,
  schoolCalendarId: string
): calendar_v3.Schema$Event {
  return {
    summary: schoolEvent.summary,
    description: schoolEvent.description,
    start: schoolEvent.start,
    end: schoolEvent.end,
    extendedProperties: {
      private: {
        schoolEventId: schoolEvent.id!,
        schoolSourceCalendarId: 'school',
        schoolCalendarId,
      },
    },
  };
}

/**
 * Mirror selected school calendars one-way to the user's personal Google account.
 *
 * For each enabled school calendar:
 *  1. Ensures a mirror sub-calendar on the personal account (DB-cached)
 *  2. Fetches school events (30 days ago to 90 days ahead)
 *  3. Bulk-fetches existing mirror events for dedup
 *  4. Inserts new events, updates changed events, skips unchanged
 *
 * School event titles are copied verbatim — no cleanup applied.
 *
 * @param userId - The user's internal DB ID
 * @param onProgress - Optional progress callback
 * @returns MirrorSummary with counts
 */
export async function mirrorSchoolCalendars(
  userId: number,
  onProgress?: MirrorProgressCallback
): Promise<MirrorSummary> {
  const summary: MirrorSummary = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Fetch tokens for both accounts
  const [schoolToken, personalToken] = await Promise.all([
    getFreshAccessToken(userId, 'school'),
    getFreshAccessToken(userId, 'personal'),
  ]);

  if (!schoolToken || !personalToken) {
    return summary;
  }

  // Create separate calendar clients for school and personal accounts
  const schoolAuth = new google.auth.OAuth2();
  schoolAuth.setCredentials({ access_token: schoolToken });
  const schoolCalendar = google.calendar({ version: 'v3', auth: schoolAuth });

  const personalAuth = new google.auth.OAuth2();
  personalAuth.setCredentials({ access_token: personalToken });
  const personalCalendar = google.calendar({ version: 'v3', auth: personalAuth });

  // Get selected school calendars from DB (enabled = true only)
  const selectedCalendars = await db.query.schoolCalendarSelections.findMany({
    where: eq(schoolCalendarSelections.userId, userId),
  });

  const enabledCalendars = selectedCalendars.filter((cal) => cal.enabled);

  for (const cal of enabledCalendars) {
    const calName = cal.schoolCalendarName;

    try {
      // Step 1: Ensure mirror sub-calendar on personal account
      const mirrorCalId = await ensureMirrorSubCalendar(
        personalCalendar,
        userId,
        cal.schoolCalendarId,
        calName
      );

      // Step 2: Fetch school events (time-bounded window)
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const schoolEventsResponse = await schoolCalendar.events.list({
        calendarId: cal.schoolCalendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        maxResults: 2500,
      });
      const schoolEvents = schoolEventsResponse.data.items ?? [];

      // Step 3: Bulk-fetch existing mirror events for dedup
      const mirrorEventsResponse = await personalCalendar.events.list({
        calendarId: mirrorCalId,
        privateExtendedProperty: ['schoolSourceCalendarId=school'],
        maxResults: 2500,
        singleEvents: true,
      });

      const existingBySchoolId = new Map<string, calendar_v3.Schema$Event>();
      for (const item of mirrorEventsResponse.data.items ?? []) {
        const schoolEventId = item.extendedProperties?.private?.schoolEventId;
        if (schoolEventId) {
          existingBySchoolId.set(schoolEventId, item);
        }
      }

      // Step 4: Diff and sync
      for (let i = 0; i < schoolEvents.length; i++) {
        const schoolEvent = schoolEvents[i];
        if (!schoolEvent.id) continue;

        const mirrorEventBody = buildMirrorEvent(schoolEvent, cal.schoolCalendarId);
        const existingMirror = existingBySchoolId.get(schoolEvent.id);

        try {
          if (!existingMirror) {
            // New event — insert
            await personalCalendar.events.insert({
              calendarId: mirrorCalId,
              requestBody: mirrorEventBody,
            });
            summary.inserted++;
          } else if (mirrorEventChanged(schoolEvent, existingMirror)) {
            // Changed event — update
            await personalCalendar.events.update({
              calendarId: mirrorCalId,
              eventId: existingMirror.id!,
              requestBody: mirrorEventBody,
            });
            summary.updated++;
          } else {
            // Unchanged — skip
            summary.skipped++;
          }
        } catch (err: unknown) {
          summary.failed++;
          const message = err instanceof Error ? err.message : String(err);
          summary.errors.push(`[${calName}] ${schoolEvent.summary ?? 'unknown'}: ${message}`);
        }

        onProgress?.(calName, i + 1, schoolEvents.length);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`[${calName}] Calendar-level error: ${message}`);
    }
  }

  return summary;
}

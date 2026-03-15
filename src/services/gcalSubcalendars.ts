/**
 * gcalSubcalendars.ts
 * Helper for creating and caching Google Calendar sub-calendars.
 * Sub-calendars are created once and their calendarId is stored in DB to avoid duplication.
 */

import { calendar_v3 } from 'googleapis';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { courseSelections, schoolCalendarSelections, courseTypeCalendars } from '@/lib/db/schema';
import { CanvasEventType } from './eventTypeClassifier';

/**
 * Ensure a sub-calendar exists for a given Canvas course on the personal account.
 * Checks DB first — if a calendarId is stored, returns it without any API call.
 * If not found, creates a new calendar via the Google Calendar API and stores the ID.
 *
 * @param calendar - Google Calendar API client (authenticated to personal account)
 * @param userId - The user's internal DB ID
 * @param courseName - The Canvas course name (used as part of the calendar summary)
 * @param colorId - Google Calendar colorId (1-11 palette) to assign to the sub-calendar
 * @returns The Google Calendar ID of the sub-calendar
 */
export async function ensureSubCalendar(
  calendar: calendar_v3.Calendar,
  userId: number,
  courseName: string,
  colorId: string
): Promise<string> {
  // Check DB for an existing sub-calendar ID
  const existing = await db.query.courseSelections.findFirst({
    where: and(
      eq(courseSelections.userId, userId),
      eq(courseSelections.courseName, courseName)
    ),
  });

  if (existing?.gcalCalendarId) {
    return existing.gcalCalendarId;
  }

  // Create a new sub-calendar on the personal Google account
  const insertRes = await calendar.calendars.insert({
    requestBody: {
      summary: `Canvas - ${courseName}`,
    },
  });

  const calendarId = (insertRes.data as calendar_v3.Schema$Calendar).id!;

  // Set the calendar color via calendarList.patch (colorId goes on the list entry, not the calendar)
  await calendar.calendarList.patch({
    calendarId,
    colorRgbFormat: false,
    requestBody: {
      colorId,
    },
  }).catch(() => {
    // Non-fatal: color not set, calendar still created
  });

  // Persist the new calendarId in DB so we don't re-create it next sync
  await db
    .update(courseSelections)
    .set({ gcalCalendarId: calendarId })
    .where(
      and(
        eq(courseSelections.userId, userId),
        eq(courseSelections.courseName, courseName)
      )
    );

  return calendarId;
}

/**
 * Ensure a mirror sub-calendar exists on the personal account for a given school calendar.
 * Follows the same DB-check-first pattern as ensureSubCalendar.
 *
 * @param calendar - Google Calendar API client (authenticated to personal account)
 * @param userId - The user's internal DB ID
 * @param schoolCalendarId - The Google Calendar ID of the source school calendar
 * @param calendarName - The school calendar's display name
 * @returns The Google Calendar ID of the mirror sub-calendar on the personal account
 */
export async function ensureMirrorSubCalendar(
  calendar: calendar_v3.Calendar,
  userId: number,
  schoolCalendarId: string,
  calendarName: string
): Promise<string> {
  // Check DB for existing mirror calendar ID
  const existing = await db.query.schoolCalendarSelections.findFirst({
    where: and(
      eq(schoolCalendarSelections.userId, userId),
      eq(schoolCalendarSelections.schoolCalendarId, schoolCalendarId)
    ),
  });

  if (existing?.gcalMirrorCalendarId) {
    return existing.gcalMirrorCalendarId;
  }

  // Create a new mirror sub-calendar on the personal account
  const mirrorRes = await calendar.calendars.insert({
    requestBody: {
      summary: `School - ${calendarName}`,
    },
  });

  const mirrorCalendarId = (mirrorRes.data as calendar_v3.Schema$Calendar).id!;

  // Persist the mirror calendarId in DB
  await db
    .update(schoolCalendarSelections)
    .set({ gcalMirrorCalendarId: mirrorCalendarId })
    .where(
      and(
        eq(schoolCalendarSelections.userId, userId),
        eq(schoolCalendarSelections.schoolCalendarId, schoolCalendarId)
      )
    );

  return mirrorCalendarId;
}

/**
 * Ensure a sub-calendar exists for a given (course, event type) pair on the personal account.
 * Checks courseTypeCalendars table first — if a calendarId is stored, returns it without any API call.
 * If not found, creates a new calendar via the Google Calendar API and stores the ID.
 *
 * Calendar naming: `Canvas - ${courseName} — ${typeLabel}s`
 * Examples: (Math 101, assignment) → 'Canvas - Math 101 — Assignments'
 *           (CS 201, quiz) → 'Canvas - CS 201 — Quizzes'
 *
 * @param calendar - Google Calendar API client (authenticated to personal account)
 * @param userId - The user's internal DB ID
 * @param courseName - The Canvas course name
 * @param eventType - The event type bucket (assignment, quiz, discussion, announcement, event)
 * @param colorId - Google Calendar colorId (1-11 palette) to assign to the sub-calendar
 * @returns The Google Calendar ID of the type sub-calendar
 */
export async function ensureTypeSubCalendar(
  calendar: calendar_v3.Calendar,
  userId: number,
  courseName: string,
  eventType: CanvasEventType,
  colorId: string
): Promise<string> {
  // Check DB for an existing type sub-calendar ID
  const existing = await db.query.courseTypeCalendars.findFirst({
    where: and(
      eq(courseTypeCalendars.userId, userId),
      eq(courseTypeCalendars.courseName, courseName),
      eq(courseTypeCalendars.eventType, eventType)
    ),
  });

  if (existing?.gcalCalendarId) {
    return existing.gcalCalendarId;
  }

  // Build calendar name: capitalize first letter + pluralize
  // Handle irregular plurals: quiz → Quizzes (ends in z → add zes)
  const base = eventType.charAt(0).toUpperCase() + eventType.slice(1);
  const typeLabel = base.endsWith('z') ? base + 'zes' : base + 's';

  // Create a new type sub-calendar on the personal Google account
  const insertRes = await calendar.calendars.insert({
    requestBody: {
      summary: `Canvas - ${courseName} — ${typeLabel}`,
    },
  });

  const calendarId = (insertRes.data as calendar_v3.Schema$Calendar).id!;

  // Set the calendar color via calendarList.patch
  await calendar.calendarList.patch({
    calendarId,
    colorRgbFormat: false,
    requestBody: {
      colorId,
    },
  }).catch(() => {
    // Non-fatal: color not set, calendar still created
  });

  // Persist the new calendarId in DB so we don't re-create it next sync
  await db.insert(courseTypeCalendars).values({
    userId,
    courseName,
    eventType,
    gcalCalendarId: calendarId,
  });

  return calendarId;
}

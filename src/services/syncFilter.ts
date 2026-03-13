import { db } from "@/lib/db";
import { courseSelections, eventOverrides } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { CanvasEvent, GroupedEvents } from "./icalParser";

/**
 * Filters grouped Canvas events for a user based on their course selections
 * and per-event overrides.
 *
 * Business rules:
 * - Course with no DB row defaults to enabled (auto-include new courses)
 * - Course with enabled=false excludes ALL its events
 * - Event with no eventOverrides row defaults to enabled
 * - Event with an eventOverrides row where enabled=false is excluded even if course is enabled
 *
 * @param userId - The user's DB id
 * @param groupedEvents - Events grouped by course name from icalParser
 * @returns Flat array of CanvasEvent that pass both course and event filters
 */
export async function filterEventsForSync(
  userId: number,
  groupedEvents: GroupedEvents
): Promise<CanvasEvent[]> {
  // Fetch all course selections for this user
  const userCourseSelections = await db.query.courseSelections.findMany({
    where: eq(courseSelections.userId, userId),
  });

  // Build a map of courseName -> enabled for quick lookup
  const courseEnabledMap = new Map<string, boolean>(
    userCourseSelections.map((cs) => [cs.courseName, cs.enabled])
  );

  // Fetch all event overrides for this user
  const userEventOverrides = await db.query.eventOverrides.findMany({
    where: eq(eventOverrides.userId, userId),
  });

  // Build a map of eventUid -> enabled for quick lookup
  const eventEnabledMap = new Map<string, boolean>(
    userEventOverrides.map((eo) => [eo.eventUid, eo.enabled])
  );

  const filteredEvents: CanvasEvent[] = [];

  for (const [courseName, events] of Object.entries(groupedEvents)) {
    // Course defaults to enabled if no DB row exists
    const courseEnabled = courseEnabledMap.has(courseName)
      ? courseEnabledMap.get(courseName)!
      : true;

    // Skip all events in this course if the course is disabled
    if (!courseEnabled) continue;

    for (const event of events) {
      // Event defaults to enabled if no override row exists
      const eventEnabled = eventEnabledMap.has(event.uid)
        ? eventEnabledMap.get(event.uid)!
        : true;

      if (eventEnabled) {
        filteredEvents.push(event);
      }
    }
  }

  return filteredEvents;
}

/**
 * Upserts courseSelections rows for any new courses not yet tracked in DB.
 * Called after parsing a Canvas feed so new courses appear in the UI immediately.
 *
 * @param userId - The user's DB id
 * @param courseNames - Array of course names from the parsed feed
 */
export async function ensureCourseSelections(
  userId: number,
  courseNames: string[]
): Promise<void> {
  if (courseNames.length === 0) return;

  // Fetch existing selections to find which courses are already tracked
  const existing = await db.query.courseSelections.findMany({
    where: eq(courseSelections.userId, userId),
  });

  const existingNames = new Set(existing.map((cs) => cs.courseName));
  const newCourses = courseNames.filter((name) => !existingNames.has(name));

  if (newCourses.length === 0) return;

  // Insert rows for new courses with defaults (enabled=true, colorId='9')
  await db.insert(courseSelections).values(
    newCourses.map((courseName) => ({
      userId,
      courseName,
      enabled: true,
      colorId: "9",
    }))
  );
}

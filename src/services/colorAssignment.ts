import { db } from "@/lib/db";
import { courseSelections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Google Calendar's 11 event colorIds mapped to their human-readable names.
 * These are the ONLY valid colorIds for calendar event objects.
 * Note: Sub-calendar colorIds use a different 24-color palette.
 */
export const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  "1": "Lavender",
  "2": "Sage",
  "3": "Grape",
  "4": "Flamingo",
  "5": "Banana",
  "6": "Tangerine",
  "7": "Peacock",
  "8": "Graphite",
  "9": "Blueberry",
  "10": "Basil",
  "11": "Tomato",
};

const COLOR_IDS = Object.keys(GOOGLE_CALENDAR_COLORS); // ["1", "2", ..., "11"]

/**
 * Assigns distinct Google Calendar colorIds to courses for a user.
 *
 * Business rules:
 * - Courses already in DB keep their existing colorId
 * - New courses get the next unused colorId from 1-11 (round-robin if >11 courses)
 * - Upserts courseSelections rows with assigned colorId
 *
 * @param userId - The user's DB id
 * @param courseNames - Array of course names to assign colors to
 * @returns Record mapping courseName -> colorId
 */
export async function assignCourseColors(
  userId: number,
  courseNames: string[]
): Promise<Record<string, string>> {
  if (courseNames.length === 0) return {};

  // Fetch existing selections for this user
  const existing = await db.query.courseSelections.findMany({
    where: eq(courseSelections.userId, userId),
  });

  // Build existing map: courseName -> colorId
  const existingMap = new Map<string, string>(
    existing.map((cs) => [cs.courseName, cs.colorId])
  );

  // Collect colorIds already assigned to known courses
  const usedColorIds = new Set<string>(existing.map((cs) => cs.colorId));

  // Build result map starting with existing assignments
  const result: Record<string, string> = {};
  for (const [name, colorId] of existingMap.entries()) {
    result[name] = colorId;
  }

  // For new courses, assign unused colorIds (round-robin)
  const newCourses = courseNames.filter((name) => !existingMap.has(name));

  if (newCourses.length === 0) return result;

  // Find colorIds not yet used, in order 1-11
  const availableColors = COLOR_IDS.filter((id) => !usedColorIds.has(id));

  // Collect upsert values
  const upsertValues: Array<{
    userId: number;
    courseName: string;
    colorId: string;
    enabled: boolean;
  }> = [];

  for (let i = 0; i < newCourses.length; i++) {
    const courseName = newCourses[i];
    // Round-robin from available first, then full palette
    let colorId: string;
    if (availableColors.length > 0) {
      colorId = availableColors.shift()!;
    } else {
      // All 11 used — wrap around (round-robin from beginning)
      colorId = COLOR_IDS[i % COLOR_IDS.length];
    }
    result[courseName] = colorId;
    upsertValues.push({ userId, courseName, colorId, enabled: true });
  }

  // Upsert new course selections with assigned colors
  await db
    .insert(courseSelections)
    .values(upsertValues)
    .onConflictDoUpdate({
      target: [courseSelections.userId, courseSelections.courseName],
      set: {
        colorId: courseSelections.colorId,
      },
    });

  return result;
}

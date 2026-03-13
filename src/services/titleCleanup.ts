import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { eventTitleCache } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Cleans a Canvas event title using regex only (no AI call).
 * Strips trailing bracketed course tags and leading boilerplate prefixes.
 */
function regexCleanTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();
  // Remove trailing bracketed content: "Assignment [CS 201-001 Spring 2026]" -> "Assignment"
  cleaned = cleaned.replace(/\s*\[.*?\]\s*$/, "").trim();
  // Remove leading "Submit Assignment: ", "Submit Assignment ", or "Submit " prefix
  cleaned = cleaned.replace(/^Submit(?:\s+Assignment)?:?\s+/i, "").trim();
  return cleaned || rawTitle;
}

/**
 * Cleans a single Canvas event title.
 *
 * Resolution order:
 * 1. Check eventTitleCache for an exact originalTitle match — return cached
 * 2. If ANTHROPIC_API_KEY is set, call claude-3-haiku-20240307 for cleanup
 * 3. Otherwise fall back to regex cleanup
 * 4. Cache the result before returning
 *
 * @param rawTitle - The raw Canvas event title
 * @returns The cleaned title string
 */
export async function getCleanedTitle(rawTitle: string): Promise<string> {
  // 1. Cache check
  const cached = await db.query.eventTitleCache.findFirst({
    where: eq(eventTitleCache.originalTitle, rawTitle),
  });
  if (cached) return cached.cleanedTitle;

  let cleanedTitle: string;

  // 2. AI cleanup or regex fallback
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 80,
        system:
          "You clean Canvas LMS assignment titles. Remove bracketed course codes like [CS 201-001 Spring 2026]. Remove boilerplate like \"Submit Assignment:\" or \"Submit \". Keep the assignment name short and clear. Truncate to under 60 characters. Return ONLY the cleaned title, no explanation.",
        messages: [{ role: "user", content: rawTitle }],
      });
      const block = response.content[0];
      cleanedTitle =
        block.type === "text" ? block.text.trim() : regexCleanTitle(rawTitle);
    } catch {
      // If AI call fails, fall back to regex
      cleanedTitle = regexCleanTitle(rawTitle);
    }
  } else {
    cleanedTitle = regexCleanTitle(rawTitle);
  }

  // 3. Cache the result
  try {
    await db
      .insert(eventTitleCache)
      .values({ originalTitle: rawTitle, cleanedTitle })
      .onConflictDoNothing();
  } catch {
    // Ignore cache write failures — we still return the cleaned title
  }

  return cleanedTitle;
}

/**
 * Cleans multiple Canvas event titles efficiently.
 *
 * - Bulk-checks cache for all titles in one query
 * - Only calls AI for titles not already cached
 * - Returns a map of rawTitle -> cleanedTitle
 *
 * @param rawTitles - Array of raw Canvas event titles
 * @returns Record mapping each rawTitle to its cleanedTitle
 */
export async function cleanTitlesBatch(
  rawTitles: string[]
): Promise<Record<string, string>> {
  if (rawTitles.length === 0) return {};

  const uniqueTitles = [...new Set(rawTitles)];
  const result: Record<string, string> = {};

  // Bulk cache lookup
  const cachedRows = await db.query.eventTitleCache.findMany({
    where: inArray(eventTitleCache.originalTitle, uniqueTitles),
  });

  const cachedMap = new Map<string, string>(
    cachedRows.map((row) => [row.originalTitle, row.cleanedTitle])
  );

  // Populate result from cache
  for (const title of uniqueTitles) {
    if (cachedMap.has(title)) {
      result[title] = cachedMap.get(title)!;
    }
  }

  // Find uncached titles
  const uncachedTitles = uniqueTitles.filter((t) => !cachedMap.has(t));
  if (uncachedTitles.length === 0) return result;

  // Clean uncached titles (calls AI or regex per title)
  await Promise.all(
    uncachedTitles.map(async (title) => {
      const cleaned = await getCleanedTitle(title);
      result[title] = cleaned;
    })
  );

  return result;
}

/**
 * eventTypeClassifier.ts
 * Classifies Canvas event titles into human-readable category labels.
 *
 * Two-tier approach:
 *  1. Fast-path regex classifier for well-known Canvas prefixes
 *  2. AI fallback using Claude Haiku for events that don't match known patterns
 *
 * Results are cached in the classifierCache DB table to avoid re-classifying
 * on subsequent syncs.
 */

import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classifierCache } from '@/lib/db/schema';

// ---- Fast-path regex classifier -----------------------------------------

/**
 * Attempts to classify an event title using regex patterns for known Canvas
 * event prefixes. Returns a human-readable category label on match, or null
 * if the title doesn't match any known pattern.
 *
 * @param summary - Raw Canvas event title
 * @returns Human-readable category label or null
 */
export function classifyByRegex(summary: string): string | null {
  try {
    if (/^submit\s+(assignment:?\s+)?/i.test(summary)) return 'Assignments';
    if (/^quiz[:\s]/i.test(summary)) return 'Quizzes';
    if (/^discussion[:\s]/i.test(summary)) return 'Discussions';
    if (/^announcement[:\s]/i.test(summary)) return 'Announcements';
    if (/^(exam|midterm|final)[:\s]/i.test(summary)) return 'Exams';
    if (/^(lab|laboratory)[:\s]/i.test(summary)) return 'Labs';
    if (/^(lecture|class session)[:\s]/i.test(summary)) return 'Lectures';
    if (/^(project|capstone)[:\s]/i.test(summary)) return 'Projects';
  } catch {
    // fallthrough to null
  }
  return null;
}

// ---- AI batch classifier -------------------------------------------------

const anthropic = new Anthropic();

const CLASSIFIER_SYSTEM_PROMPT = `You are a Canvas LMS event classifier. Given a list of Canvas event titles, classify each one into a short, human-readable category label.

Rules:
- Use plural, title-case labels like: "Assignments", "Quizzes", "Discussions", "Announcements", "Exams", "Labs", "Lectures", "Projects", "Office Hours", "Events"
- Be consistent: similar event names must get the same label
- Default to "Events" for anything that doesn't fit a clearer category
- Respond ONLY with a JSON array of strings, one category per input event, in the same order
- No explanation, no markdown, just the JSON array

Example input:
["Submit Assignment: HW1 [CS 201]", "Midterm Exam [CS 201]", "Lab Report 2 [CHEM 101]"]

Example output:
["Assignments", "Exams", "Labs"]`;

/**
 * Batch-classify a list of event summaries using the Claude Haiku AI model.
 * Returns an array of category labels in the same order as the input.
 *
 * Falls back to "Events" for any entry if the AI response is malformed.
 *
 * @param summaries - Array of raw Canvas event titles
 * @returns Array of human-readable category labels
 */
export async function classifyBatchWithAI(summaries: string[]): Promise<string[]> {
  if (summaries.length === 0) return [];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(summaries),
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    // AI returned something unparseable — default all to 'Events'
    return summaries.map(() => 'Events');
  }

  if (!Array.isArray(parsed)) {
    return summaries.map(() => 'Events');
  }

  // Ensure we have the right number of entries and all are strings
  return summaries.map((_, i) => {
    const entry = parsed[i];
    return typeof entry === 'string' && entry.length > 0 ? entry : 'Events';
  });
}

// ---- Cached classifier ---------------------------------------------------

/**
 * Classify a list of event summaries with cache-first strategy:
 *  1. Check DB cache for each summary
 *  2. Fast-path regex for uncached summaries
 *  3. Batch AI call for any remaining uncached summaries
 *  4. Persist new classifications to DB cache
 *
 * @param summaries - Array of raw Canvas event titles (may contain duplicates)
 * @returns Map from event summary to category label
 */
export async function classifyEventsWithCache(
  summaries: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueSummaries = [...new Set(summaries)];
  const needsAI: string[] = [];

  for (const summary of uniqueSummaries) {
    // Check DB cache first
    const cached = await db.query.classifierCache.findFirst({
      where: eq(classifierCache.eventNamePattern, summary),
    });

    if (cached) {
      result.set(summary, cached.category);
      continue;
    }

    // Try fast-path regex
    const regexResult = classifyByRegex(summary);
    if (regexResult !== null) {
      result.set(summary, regexResult);
      // Persist to cache so we skip DB check next time
      await db.insert(classifierCache).values({
        eventNamePattern: summary,
        category: regexResult,
      }).onConflictDoNothing();
      continue;
    }

    // Neither cached nor regex-matched — needs AI
    needsAI.push(summary);
  }

  // Batch AI classify remaining summaries
  if (needsAI.length > 0) {
    const aiLabels = await classifyBatchWithAI(needsAI);
    for (let i = 0; i < needsAI.length; i++) {
      const summary = needsAI[i]!;
      const label = aiLabels[i] ?? 'Events';
      result.set(summary, label);
      // Persist to cache
      await db.insert(classifierCache).values({
        eventNamePattern: summary,
        category: label,
      }).onConflictDoNothing();
    }
  }

  return result;
}

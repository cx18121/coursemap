export type CanvasEventType = 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'event';

/**
 * Classifies a Canvas event title into one of 5 type buckets.
 *
 * Matching is based on title prefix patterns:
 *  - 'assignment' : starts with "Submit" (with optional "Assignment:")
 *  - 'quiz'       : starts with "Quiz:" or "Quiz "
 *  - 'discussion' : starts with "Discussion:" or "Discussion "
 *  - 'announcement': starts with "Announcement:" or "Announcement "
 *  - 'event'      : catch-all for anything else
 *
 * This function never throws — returns 'event' on any unexpected input.
 *
 * @param summary - Raw Canvas event title (e.g. "Submit Assignment: HW1 [CS 201]")
 * @returns CanvasEventType literal
 */
export function classifyEventType(summary: string): CanvasEventType {
  try {
    if (/^submit\s+(assignment:?\s+)?/i.test(summary)) return 'assignment';
    if (/^quiz[:\s]/i.test(summary)) return 'quiz';
    if (/^discussion[:\s]/i.test(summary)) return 'discussion';
    if (/^announcement[:\s]/i.test(summary)) return 'announcement';
  } catch {
    // fallthrough to 'event' on any unexpected regex error
  }
  return 'event';
}

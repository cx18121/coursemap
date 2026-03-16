import ical, { VEvent } from 'node-ical';
import { classifyEventsWithCache } from './eventTypeClassifier';

export interface CanvasEvent {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  courseName: string;
  uid: string;
  eventType: string; // human-readable category label e.g. 'Assignments', 'Lab Reports'
}

export type GroupedEvents = Record<string, CanvasEvent[]>;

/**
 * Validates whether a provided string is a valid URL.
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the course name from a Canvas ICS event summary.
 * Canvas usually appends the course name in brackets, like: "Assignment 1 [Course Name]"
 */
function extractCourseName(summary: string): string {
  const match = summary.match(/\[(.*?)\]$/);
  return match ? match[1].trim() : 'Unknown Course';
}

/**
 * Fetches and parses a Canvas ICS feed and groups events by course name.
 * After parsing, classifies all event summaries using the two-tier classifier
 * (regex fast-path + AI fallback with DB caching).
 *
 * @param feedUrl The provided Canvas .ics URL.
 * @returns An object with course names as keys and arrays of CanvasEvents as values.
 */
export async function parseCanvasFeed(feedUrl: string): Promise<GroupedEvents> {
  if (!isValidUrl(feedUrl)) {
    throw new Error('Invalid feed URL');
  }

  // Fetch and parse the ICS feed
  const eventsData = await ical.async.fromURL(feedUrl);

  // Collect raw events before classification
  const rawEvents: Array<{
    summary: string;
    description: string;
    start: Date;
    end: Date;
    courseName: string;
    uid: string;
  }> = [];

  for (const k in eventsData) {
    if (Object.prototype.hasOwnProperty.call(eventsData, k)) {
      const component = eventsData[k];

      if (!component) continue;

      if (component.type === 'VEVENT') {
        const ev = component as VEvent;
        const summary = ev.summary ? String(ev.summary) : 'Untitled Event';
        const courseName = extractCourseName(summary);

        rawEvents.push({
          summary,
          description: ev.description ? String(ev.description) : '',
          start: ev.start as Date,
          end: ev.end as Date,
          courseName,
          uid: ev.uid ? String(ev.uid) : k,
        });
      }
    }
  }

  // Classify all summaries in one batch (cache-first, regex fast-path, AI fallback)
  const allSummaries = rawEvents.map((e) => e.summary);
  const classificationMap = await classifyEventsWithCache(allSummaries);

  // Build grouped events with classifications
  const groupedEvents: GroupedEvents = {};

  for (const raw of rawEvents) {
    const eventType = classificationMap.get(raw.summary) ?? 'Events';

    const canvasEvent: CanvasEvent = {
      ...raw,
      eventType,
    };

    if (!groupedEvents[raw.courseName]) {
      groupedEvents[raw.courseName] = [];
    }

    groupedEvents[raw.courseName].push(canvasEvent);
  }

  return groupedEvents;
}

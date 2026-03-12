import ical, { CalendarComponent, VEvent } from 'node-ical';

export interface CanvasEvent {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  courseName: string;
  uid: string;
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

  const groupedEvents: GroupedEvents = {};

  // Iterate over parsed values
  for (const k in eventsData) {
    if (Object.prototype.hasOwnProperty.call(eventsData, k)) {
      const component = eventsData[k];

      // Guard against undefined (TypeScript index signature)
      if (!component) continue;

      // We only care about VEVENTs (actual events and assignments)
      if (component.type === 'VEVENT') {
        const ev = component as VEvent;
        // node-ical fields are ParameterValue objects, coerce to string
        const summary = ev.summary ? String(ev.summary) : 'Untitled Event';
        const courseName = extractCourseName(summary);

        const canvasEvent: CanvasEvent = {
          summary,
          description: ev.description ? String(ev.description) : '',
          start: ev.start as Date,
          end: ev.end as Date,
          courseName,
          uid: ev.uid ? String(ev.uid) : k,
        };

        if (!groupedEvents[courseName]) {
          groupedEvents[courseName] = [];
        }

        groupedEvents[courseName].push(canvasEvent);
      }
    }
  }

  return groupedEvents;
}

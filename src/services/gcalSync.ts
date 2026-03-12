import { google, calendar_v3 } from 'googleapis';
import { CanvasEvent } from './icalParser';

interface SyncOptions {
  accessToken: string;
  events: CanvasEvent[];
  courseColorMap: Record<string, string>; // Maps course names to Google Calendar color IDs
  calendarId?: string; // Defaults to 'primary'
}

interface SyncResult {
  action: 'inserted' | 'updated' | 'failed';
  event: calendar_v3.Schema$Event;
  error?: any;
}

/**
 * Syncs parsed Canvas events directly to the user's Google Calendar with smoothed concurrency.
 * 
 * @param options Access token, events to sync, and color preferences
 * @returns Array of inserted/updated event responses
 */
export async function syncToGoogleCalendar({
  accessToken,
  events,
  courseColorMap,
  calendarId = 'primary'
}: SyncOptions) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth });
  
  // Lower concurrency + sliding window to avoid "burst" rate limit triggers
  const CONCURRENCY = 3; 
  const results: SyncResult[] = [];

  // Helper to sync a single event
  const syncEvent = async (event: CanvasEvent): Promise<SyncResult> => {
    const colorId = courseColorMap[event.courseName] || undefined;

    const gcalEvent: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: new Date(event.start).toISOString(),
      },
      end: {
        dateTime: new Date(event.end).toISOString(),
      },
      colorId,
      extendedProperties: {
        private: {
          canvasCanvasUid: event.uid,
          canvasCourseName: event.courseName
        }
      }
    };

    try {
      // Check if event already exists
      const existingEventsResponse = await calendar.events.list({
        calendarId,
        privateExtendedProperty: [`canvasCanvasUid=${event.uid}`],
        maxResults: 1
      });

      if (existingEventsResponse.data.items && existingEventsResponse.data.items.length > 0) {
        const existingEventId = existingEventsResponse.data.items[0].id!;
        const updatedEvent = await calendar.events.update({
          calendarId,
          eventId: existingEventId,
          requestBody: gcalEvent
        });
        return { action: 'updated', event: updatedEvent.data };
      } else {
        const newEvent = await calendar.events.insert({
          calendarId,
          requestBody: gcalEvent
        });
        return { action: 'inserted', event: newEvent.data };
      }
    } catch (error) {
      console.error(`Failed to sync Canvas event: ${event.summary}`, error);
      return { action: 'failed', event: gcalEvent, error };
    }
  };

  // Sliding window queue implementation
  const queue = [...events];
  const running: Promise<void>[] = [];

  const runQueue = async () => {
    while (queue.length > 0) {
      const event = queue.shift()!;
      const result = await syncEvent(event);
      results.push(result);
    }
  };

  // Start the specified number of "workers"
  for (let i = 0; i < Math.min(CONCURRENCY, events.length); i++) {
    running.push(runQueue());
  }

  // Wait for all workers to finish
  await Promise.all(running);

  return results;
}

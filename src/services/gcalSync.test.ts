/**
 * Tests for gcalSync.ts — bulk dedup and per-course sub-calendar sync
 * Uses mocked googleapis and drizzle to avoid real API calls
 */

// Mock googleapis before importing anything that uses it
const mockCalendarsInsert = jest.fn();
const mockCalendarListPatch = jest.fn();
const mockEventsInsert = jest.fn();
const mockEventsUpdate = jest.fn();
const mockEventsList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    calendar: jest.fn().mockReturnValue({
      calendars: {
        insert: mockCalendarsInsert,
      },
      calendarList: {
        patch: mockCalendarListPatch,
      },
      events: {
        list: mockEventsList,
        insert: mockEventsInsert,
        update: mockEventsUpdate,
      },
    }),
  },
}));

// Mock @/lib/tokens
const mockGetFreshAccessToken = jest.fn();
jest.mock('@/lib/tokens', () => ({
  getFreshAccessToken: mockGetFreshAccessToken,
}));

// Mock @/lib/db
const mockDb = {
  query: {
    courseSelections: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@/lib/db', () => ({
  db: mockDb,
}));

// Mock drizzle-orm eq/and operators
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: unknown, val: unknown) => ({ col, val, type: 'eq' })),
  and: jest.fn((...args: unknown[]) => ({ args, type: 'and' })),
}));

// Mock schema
jest.mock('@/lib/db/schema', () => ({
  courseSelections: { userId: 'userId', courseName: 'courseName', gcalCalendarId: 'gcalCalendarId' },
}));

import { syncCanvasEvents, SyncProgress, SyncSummary } from './gcalSync';
import { CanvasEvent } from './icalParser';

describe('gcalSync - bulk dedup and sub-calendar sync', () => {
  const FAKE_TOKEN = 'fake-access-token';
  const USER_ID = 42;

  const makeEvent = (overrides: Partial<CanvasEvent> = {}): CanvasEvent => ({
    summary: 'Assignment 1',
    description: 'Do the thing',
    start: new Date('2026-04-01T10:00:00Z'),
    end: new Date('2026-04-01T11:00:00Z'),
    courseName: 'Math 101',
    uid: 'uid-1',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFreshAccessToken.mockResolvedValue(FAKE_TOKEN);
    // Default: no existing sub-calendar in DB
    mockDb.query.courseSelections.findFirst.mockResolvedValue(null);
    // Default: calendars.insert returns a new calendar
    mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-cal-id-123' } });
    // Default: calendarList.patch succeeds (sets sub-calendar color)
    mockCalendarListPatch.mockResolvedValue({ data: {} });
    // Default: events.list returns empty (no existing events)
    mockEventsList.mockResolvedValue({ data: { items: [] } });
    // Default: insert succeeds
    mockEventsInsert.mockResolvedValue({ data: { id: 'new-event-id' } });
    // Default: update succeeds
    mockEventsUpdate.mockResolvedValue({ data: { id: 'updated-event-id' } });
  });

  describe('authentication', () => {
    it('throws if getFreshAccessToken returns null', async () => {
      mockGetFreshAccessToken.mockResolvedValue(null);
      await expect(
        syncCanvasEvents(USER_ID, [makeEvent()], {})
      ).rejects.toThrow(/access token/i);
    });

    it('calls getFreshAccessToken with userId and "personal" role', async () => {
      await syncCanvasEvents(USER_ID, [], {});
      expect(mockGetFreshAccessToken).toHaveBeenCalledWith(USER_ID, 'personal');
    });
  });

  describe('bulk dedup', () => {
    it('skips events already in Google Calendar (matching UID)', async () => {
      const event = makeEvent({ uid: 'existing-uid' });
      mockEventsList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'gcal-event-id',
              summary: event.summary,
              start: { dateTime: event.start.toISOString() },
              end: { dateTime: event.end.toISOString() },
              description: event.description,
              extendedProperties: {
                private: { canvasCanvasUid: 'existing-uid' },
              },
            },
          ],
        },
      });

      const summary = await syncCanvasEvents(USER_ID, [event], {});

      expect(mockEventsInsert).not.toHaveBeenCalled();
      expect(mockEventsUpdate).not.toHaveBeenCalled();
      expect(summary.skipped).toBe(1);
      expect(summary.inserted).toBe(0);
    });

    it('inserts new events not in Google Calendar', async () => {
      const event = makeEvent({ uid: 'new-uid' });
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      const summary = await syncCanvasEvents(USER_ID, [event], {});

      expect(mockEventsInsert).toHaveBeenCalledTimes(1);
      expect(summary.inserted).toBe(1);
      expect(summary.skipped).toBe(0);
    });

    it('uses a single events.list call per course (bulk fetch)', async () => {
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'Math 101' }),
        makeEvent({ uid: 'uid-2', courseName: 'Math 101' }),
        makeEvent({ uid: 'uid-3', courseName: 'Math 101' }),
      ];
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      await syncCanvasEvents(USER_ID, events, {});

      // Should call events.list only ONCE for all Math 101 events (bulk dedup)
      expect(mockEventsList).toHaveBeenCalledTimes(1);
      // But insert should be called for each new event
      expect(mockEventsInsert).toHaveBeenCalledTimes(3);
    });

    it('updates changed events (summary differs)', async () => {
      const event = makeEvent({ uid: 'uid-changed', summary: 'New Title' });
      mockEventsList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'gcal-event-id',
              summary: 'Old Title', // different from incoming
              start: { dateTime: event.start.toISOString() },
              end: { dateTime: event.end.toISOString() },
              description: event.description,
              extendedProperties: {
                private: { canvasCanvasUid: 'uid-changed' },
              },
            },
          ],
        },
      });

      const summary = await syncCanvasEvents(USER_ID, [event], {});

      expect(mockEventsUpdate).toHaveBeenCalledTimes(1);
      expect(summary.updated).toBe(1);
      expect(summary.skipped).toBe(0);
    });

    it('updates changed events (start date differs)', async () => {
      const event = makeEvent({
        uid: 'uid-date-changed',
        start: new Date('2026-04-02T10:00:00Z'),
      });
      mockEventsList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'gcal-event-id',
              summary: event.summary,
              start: { dateTime: '2026-04-01T10:00:00Z' }, // old date
              end: { dateTime: event.end.toISOString() },
              description: event.description,
              extendedProperties: {
                private: { canvasCanvasUid: 'uid-date-changed' },
              },
            },
          ],
        },
      });

      const summary = await syncCanvasEvents(USER_ID, [event], {});
      expect(summary.updated).toBe(1);
    });
  });

  describe('sub-calendar creation', () => {
    it('creates a new sub-calendar if none exists in DB', async () => {
      mockDb.query.courseSelections.findFirst.mockResolvedValue(null);
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-cal-id' } });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(1);
      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - Math 101',
          }),
        })
      );
    });

    it('reuses existing sub-calendar from DB (no API call)', async () => {
      mockDb.query.courseSelections.findFirst.mockResolvedValue({
        gcalCalendarId: 'existing-cal-id',
      });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockCalendarsInsert).not.toHaveBeenCalled();
      // Events should be listed on the existing calendar
      expect(mockEventsList).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'existing-cal-id' })
      );
    });

    it('stores newly created sub-calendar ID in DB', async () => {
      mockDb.query.courseSelections.findFirst.mockResolvedValue(null);
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'brand-new-cal' } });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('uses one sub-calendar per course, not one per event', async () => {
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'CS 201' }),
        makeEvent({ uid: 'uid-2', courseName: 'CS 201' }),
      ];
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'cs-cal-id' } });

      await syncCanvasEvents(USER_ID, events, {});

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(1);
    });

    it('creates separate sub-calendars for different courses', async () => {
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'Math 101' }),
        makeEvent({ uid: 'uid-2', courseName: 'CS 201' }),
      ];
      mockDb.query.courseSelections.findFirst.mockResolvedValue(null);
      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'math-cal-id' } })
        .mockResolvedValueOnce({ data: { id: 'cs-cal-id' } });
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      await syncCanvasEvents(USER_ID, events, {});

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(2);
      expect(mockEventsInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('event properties', () => {
    it('inserts events with correct extendedProperties for dedup', async () => {
      const event = makeEvent({ uid: 'my-uid', courseName: 'Math 101' });
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'cal-id' } });

      await syncCanvasEvents(USER_ID, [event], {});

      expect(mockEventsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            extendedProperties: expect.objectContaining({
              private: expect.objectContaining({
                canvasCanvasUid: 'my-uid',
                canvasSourceCalendarId: 'canvas',
              }),
            }),
          }),
        })
      );
    });

    it('does NOT set colorId on individual events (color is at sub-calendar level)', async () => {
      const event = makeEvent();
      const courseColorMap = { 'Math 101': '5' };

      await syncCanvasEvents(USER_ID, [event], courseColorMap);

      const callArg = mockEventsInsert.mock.calls[0][0];
      expect(callArg.requestBody.colorId).toBeUndefined();
    });
  });

  describe('SyncSummary counts', () => {
    it('returns accurate counts across multiple courses', async () => {
      // Math 101: 1 new, 1 existing (skip), 1 changed (update)
      // CS 201: 2 new
      const events = [
        makeEvent({ uid: 'math-new', courseName: 'Math 101' }),
        makeEvent({ uid: 'math-existing', courseName: 'Math 101' }),
        makeEvent({ uid: 'math-changed', summary: 'New Title', courseName: 'Math 101' }),
        makeEvent({ uid: 'cs-new-1', courseName: 'CS 201' }),
        makeEvent({ uid: 'cs-new-2', courseName: 'CS 201' }),
      ];

      mockDb.query.courseSelections.findFirst.mockResolvedValue(null);
      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'math-cal' } })
        .mockResolvedValueOnce({ data: { id: 'cs-cal' } });

      mockEventsList
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: 'gcal-existing',
                summary: makeEvent({ uid: 'math-existing' }).summary,
                start: { dateTime: makeEvent({ uid: 'math-existing' }).start.toISOString() },
                end: { dateTime: makeEvent({ uid: 'math-existing' }).end.toISOString() },
                description: makeEvent({ uid: 'math-existing' }).description,
                extendedProperties: { private: { canvasCanvasUid: 'math-existing' } },
              },
              {
                id: 'gcal-changed',
                summary: 'Old Title',
                start: { dateTime: makeEvent({ uid: 'math-changed' }).start.toISOString() },
                end: { dateTime: makeEvent({ uid: 'math-changed' }).end.toISOString() },
                description: makeEvent({ uid: 'math-changed' }).description,
                extendedProperties: { private: { canvasCanvasUid: 'math-changed' } },
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } });

      mockEventsInsert.mockResolvedValue({ data: { id: 'new' } });
      mockEventsUpdate.mockResolvedValue({ data: { id: 'updated' } });

      const summary = await syncCanvasEvents(USER_ID, events, {});

      expect(summary.inserted).toBe(3); // math-new + cs-new-1 + cs-new-2
      expect(summary.updated).toBe(1); // math-changed
      expect(summary.skipped).toBe(1); // math-existing
      expect(summary.failed).toBe(0);
    });

    it('records failed events in errors array', async () => {
      const event = makeEvent();
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'cal-id' } });
      mockEventsInsert.mockRejectedValue(new Error('API quota exceeded'));

      const summary = await syncCanvasEvents(USER_ID, [event], {});

      expect(summary.failed).toBe(1);
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]).toContain('quota exceeded');
    });
  });

  describe('onProgress callback', () => {
    it('calls onProgress for each event processed', async () => {
      const events = [
        makeEvent({ uid: 'uid-1' }),
        makeEvent({ uid: 'uid-2' }),
        makeEvent({ uid: 'uid-3' }),
      ];
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'cal-id' } });

      const progressCalls: SyncProgress[] = [];
      await syncCanvasEvents(USER_ID, events, {}, (p) => progressCalls.push(p));

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0]).toMatchObject({
        courseName: 'Math 101',
        processed: 1,
        total: 3,
      });
      expect(progressCalls[2].processed).toBe(3);
    });

    it('works without onProgress callback (no error thrown)', async () => {
      await expect(
        syncCanvasEvents(USER_ID, [makeEvent()], {})
      ).resolves.not.toThrow();
    });
  });
});

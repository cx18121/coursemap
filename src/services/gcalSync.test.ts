/**
 * Tests for gcalSync.ts — type-grouped sub-calendar sync with per-type filtering
 * Uses mocked googleapis and drizzle to avoid real API calls
 *
 * Design: type grouping is ALWAYS ON. Events route to per-(course, type) sub-calendars.
 * Per-type filters are loaded from courseTypeSettings DB table; default (no row) = enabled.
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

// Mock @/lib/db — support insert().values().onConflictDoNothing() and .onConflictDoUpdate() chains
const mockOnConflictDoNothing = jest.fn().mockResolvedValue(undefined);
const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
const mockValues = jest.fn().mockReturnValue({
  onConflictDoNothing: mockOnConflictDoNothing,
  onConflictDoUpdate: mockOnConflictDoUpdate,
});
const mockDb = {
  query: {
    courseTypeCalendars: {
      findFirst: jest.fn(),
    },
    courseTypeSettings: {
      findMany: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnValue({ values: mockValues }),
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
  courseTypeCalendars: {
    userId: 'userId',
    courseName: 'courseName',
    eventType: 'eventType',
    gcalCalendarId: 'gcalCalendarId',
  },
  courseTypeSettings: {
    userId: 'userId',
    courseName: 'courseName',
    eventType: 'eventType',
    enabled: 'enabled',
    colorId: 'colorId',
  },
  syncedEvents: {
    userId: 'userId',
    uid: 'uid',
    summary: 'summary',
    description: 'description',
    startAt: 'startAt',
    endAt: 'endAt',
    gcalCalendarId: 'gcalCalendarId',
    syncedAt: 'syncedAt',
  },
}));

import { syncCanvasEvents, SyncProgress } from './gcalSync';
import { CanvasEvent } from './icalParser';

describe('gcalSync - type-grouped sync with per-type filters', () => {
  const FAKE_TOKEN = 'fake-access-token';
  const USER_ID = 42;

  const makeEvent = (overrides: Partial<CanvasEvent> = {}): CanvasEvent => ({
    summary: 'Submit Assignment: HW1',
    description: 'Do the thing',
    start: new Date('2026-04-01T10:00:00Z'),
    end: new Date('2026-04-01T11:00:00Z'),
    courseName: 'Math 101',
    uid: 'uid-1',
    eventType: 'Assignments',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFreshAccessToken.mockResolvedValue(FAKE_TOKEN);
    // Default: no existing type sub-calendar in DB
    mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue(null);
    // Default: no per-type settings (all types enabled by default)
    mockDb.query.courseTypeSettings.findMany.mockResolvedValue([]);
    // Restore insert chain after clearAllMocks
    mockDb.insert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
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

    it('uses a single events.list call per type bucket per course (bulk fetch)', async () => {
      // 3 events of same type in same course → 1 events.list call
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-3', courseName: 'Math 101', eventType: 'Assignments' }),
      ];
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      await syncCanvasEvents(USER_ID, events, {});

      // 1 type bucket → 1 events.list call
      expect(mockEventsList).toHaveBeenCalledTimes(1);
      // 3 new events → 3 inserts
      expect(mockEventsInsert).toHaveBeenCalledTimes(3);
    });

    it('updates changed events (summary differs)', async () => {
      const event = makeEvent({ uid: 'uid-changed', summary: 'Submit Assignment: New Title' });
      mockEventsList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'gcal-event-id',
              summary: 'Submit Assignment: Old Title', // different from incoming
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

  describe('type sub-calendar creation', () => {
    it('creates a new type sub-calendar if none exists in DB', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue(null);
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-type-cal-id' } });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(1);
      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - Math 101 — Assignments',
          }),
        })
      );
    });

    it('reuses existing type sub-calendar from DB (no API call)', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue({
        gcalCalendarId: 'existing-type-cal-id',
      });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockCalendarsInsert).not.toHaveBeenCalled();
      expect(mockEventsList).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'existing-type-cal-id' })
      );
    });

    it('stores newly created type sub-calendar ID in DB', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue(null);
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'brand-new-type-cal' } });

      await syncCanvasEvents(USER_ID, [makeEvent()], {});

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('creates separate sub-calendars for different event types in same course', async () => {
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', courseName: 'Math 101', eventType: 'Quizzes' }),
      ];
      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'assignment-cal-id' } })
        .mockResolvedValueOnce({ data: { id: 'quiz-cal-id' } });

      await syncCanvasEvents(USER_ID, events, {});

      // 2 type buckets → 2 sub-calendar creations
      expect(mockCalendarsInsert).toHaveBeenCalledTimes(2);
      expect(mockEventsInsert).toHaveBeenCalledTimes(2);
    });

    it('creates separate sub-calendars for different courses', async () => {
      const events = [
        makeEvent({ uid: 'uid-1', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', courseName: 'CS 201', eventType: 'Assignments' }),
      ];
      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'math-assignment-cal-id' } })
        .mockResolvedValueOnce({ data: { id: 'cs-assignment-cal-id' } });
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      await syncCanvasEvents(USER_ID, events, {});

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(2);
      expect(mockEventsInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('per-type filtering', () => {
    it('skips events whose type is disabled', async () => {
      // Pre-load settings: Assignments enabled, Quizzes disabled for Math 101
      mockDb.query.courseTypeSettings.findMany.mockResolvedValue([
        { courseName: 'Math 101', eventType: 'Assignments', enabled: true, colorId: '9' },
        { courseName: 'Math 101', eventType: 'Quizzes', enabled: false, colorId: '11' },
      ]);

      const events = [
        makeEvent({ uid: 'uid-assign', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-quiz', eventType: 'Quizzes' }),
      ];

      const summary = await syncCanvasEvents(USER_ID, events, {});

      // Only Assignments should be synced
      expect(summary.inserted).toBe(1);
      // Quizzes sub-calendar should NOT be created
      expect(mockCalendarsInsert).toHaveBeenCalledTimes(1);
      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ summary: 'Canvas - Math 101 — Assignments' }),
        })
      );
    });

    it('skips all events when all types disabled', async () => {
      mockDb.query.courseTypeSettings.findMany.mockResolvedValue([
        { courseName: 'Math 101', eventType: 'Assignments', enabled: false, colorId: '9' },
        { courseName: 'Math 101', eventType: 'Quizzes', enabled: false, colorId: '11' },
      ]);

      const events = [
        makeEvent({ uid: 'uid-1', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', eventType: 'Quizzes' }),
      ];

      const summary = await syncCanvasEvents(USER_ID, events, {});

      expect(summary.inserted).toBe(0);
      expect(mockCalendarsInsert).not.toHaveBeenCalled();
    });

    it('skips disabled event types (Announcements)', async () => {
      mockDb.query.courseTypeSettings.findMany.mockResolvedValue([
        { courseName: 'Math 101', eventType: 'Announcements', enabled: false, colorId: '8' },
      ]);

      const events = [
        makeEvent({ uid: 'uid-ann', eventType: 'Announcements' }),
      ];

      const summary = await syncCanvasEvents(USER_ID, events, {});

      expect(summary.inserted).toBe(0);
      expect(mockCalendarsInsert).not.toHaveBeenCalled();
    });

    it('syncs all types when no settings exist (default all enabled)', async () => {
      // Default mock: findMany returns [] — all types enabled by default
      const events = [
        makeEvent({ uid: 'uid-1', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', eventType: 'Quizzes' }),
      ];
      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'cal-1' } })
        .mockResolvedValueOnce({ data: { id: 'cal-2' } });

      const summary = await syncCanvasEvents(USER_ID, events, {});

      expect(summary.inserted).toBe(2);
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
    it('returns accurate counts across multiple types and courses', async () => {
      // Math 101 Assignments: 1 new, 1 existing (skip), 1 changed (update)
      // CS 201 Assignments: 2 new
      const events = [
        makeEvent({ uid: 'math-new', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'math-existing', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'math-changed', summary: 'Submit Assignment: New Title', courseName: 'Math 101', eventType: 'Assignments' }),
        makeEvent({ uid: 'cs-new-1', courseName: 'CS 201', eventType: 'Assignments' }),
        makeEvent({ uid: 'cs-new-2', courseName: 'CS 201', eventType: 'Assignments' }),
      ];

      mockCalendarsInsert
        .mockResolvedValueOnce({ data: { id: 'math-assignment-cal' } })
        .mockResolvedValueOnce({ data: { id: 'cs-assignment-cal' } });

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
                summary: 'Submit Assignment: Old Title',
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
        makeEvent({ uid: 'uid-1', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-2', eventType: 'Assignments' }),
        makeEvent({ uid: 'uid-3', eventType: 'Assignments' }),
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

  describe('syncedEvents DB mirror writes (DEDUP-02)', () => {
    const { syncedEvents: mockSyncedEvents } = jest.requireMock('@/lib/db/schema');

    it('writes syncedEvents row after successful GCal insert', async () => {
      const event = makeEvent({ uid: 'new-uid' });
      mockEventsList.mockResolvedValue({ data: { items: [] } });

      await syncCanvasEvents(USER_ID, [event], {});

      // GCal insert should have succeeded
      expect(mockEventsInsert).toHaveBeenCalledTimes(1);
      // db.insert should have been called with syncedEvents table
      expect(mockDb.insert).toHaveBeenCalledWith(mockSyncedEvents);
      // onConflictDoUpdate should have been called (not onConflictDoNothing)
      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('writes syncedEvents row after successful GCal update', async () => {
      const event = makeEvent({ uid: 'uid-changed', summary: 'Updated Title' });
      mockEventsList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'gcal-event-id',
              summary: 'Old Title', // different summary triggers update
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

      await syncCanvasEvents(USER_ID, [event], {});

      // GCal update should have succeeded
      expect(mockEventsUpdate).toHaveBeenCalledTimes(1);
      // db.insert should have been called with syncedEvents table
      expect(mockDb.insert).toHaveBeenCalledWith(mockSyncedEvents);
      // onConflictDoUpdate should have been called
      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('does NOT write syncedEvents when GCal insert fails', async () => {
      const event = makeEvent({ uid: 'fail-uid' });
      mockEventsList.mockResolvedValue({ data: { items: [] } });
      // Make GCal insert throw
      mockEventsInsert.mockRejectedValue(new Error('GCal API quota exceeded'));

      const summary = await syncCanvasEvents(USER_ID, [event], {});

      expect(summary.failed).toBe(1);
      // db.insert should NOT have been called with syncedEvents
      // (it may have been called for courseTypeSettings, so check syncedEvents specifically)
      const syncedEventsInsertCalls = mockDb.insert.mock.calls.filter(
        (call: unknown[]) => call[0] === mockSyncedEvents
      );
      expect(syncedEventsInsertCalls).toHaveLength(0);
    });
  });
});

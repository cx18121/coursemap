/**
 * Tests for gcalSubcalendars.ts — ensureTypeSubCalendar
 * Uses mocked googleapis and drizzle to avoid real API calls
 */

// Mock googleapis before importing anything that uses it
const mockCalendarsInsert = jest.fn();
const mockCalendarListPatch = jest.fn();

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
    }),
  },
}));

// Mock @/lib/db
const mockDb = {
  query: {
    courseTypeCalendars: {
      findFirst: jest.fn(),
    },
  },
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

// Mock @/lib/db/schema
jest.mock('@/lib/db/schema', () => ({
  courseSelections: {
    userId: 'userId',
    courseName: 'courseName',
    gcalCalendarId: 'gcalCalendarId',
  },
  schoolCalendarSelections: {
    userId: 'userId',
    schoolCalendarId: 'schoolCalendarId',
    gcalMirrorCalendarId: 'gcalMirrorCalendarId',
  },
  courseTypeCalendars: {
    userId: 'userId',
    courseName: 'courseName',
    eventType: 'eventType',
    gcalCalendarId: 'gcalCalendarId',
  },
}));

import { ensureTypeSubCalendar } from './gcalSubcalendars';
import { calendar_v3 } from 'googleapis';

describe('gcalSubcalendars - ensureTypeSubCalendar', () => {
  const FAKE_CALENDAR = {
    calendars: { insert: mockCalendarsInsert },
    calendarList: { patch: mockCalendarListPatch },
  } as unknown as calendar_v3.Calendar;
  const USER_ID = 42;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing calendar in DB
    mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue(null);
    // Default: calendars.insert returns a new calendar
    mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-type-cal-id' } });
    // Default: calendarList.patch succeeds
    mockCalendarListPatch.mockResolvedValue({ data: {} });
    // Reset insert chain
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue(undefined);
  });

  describe('DB-first cache pattern', () => {
    it('returns cached gcalCalendarId when DB row exists (no API call)', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue({
        gcalCalendarId: 'cached-type-cal-id',
      });

      const result = await ensureTypeSubCalendar(
        FAKE_CALENDAR,
        USER_ID,
        'Math 101',
        'assignment',
        '5'
      );

      expect(result).toBe('cached-type-cal-id');
      expect(mockCalendarsInsert).not.toHaveBeenCalled();
    });

    it('does NOT call calendars.insert on cache hit', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue({
        gcalCalendarId: 'existing-id',
      });

      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'CS 201', 'quiz', '3');

      expect(mockCalendarsInsert).not.toHaveBeenCalled();
      expect(mockCalendarListPatch).not.toHaveBeenCalled();
    });

    it('calls calendars.insert when no DB row exists', async () => {
      mockDb.query.courseTypeCalendars.findFirst.mockResolvedValue(null);
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'created-cal-id' } });

      await ensureTypeSubCalendar(
        FAKE_CALENDAR,
        USER_ID,
        'Math 101',
        'assignment',
        '5'
      );

      expect(mockCalendarsInsert).toHaveBeenCalledTimes(1);
    });

    it('inserts row into courseTypeCalendars after calendar creation', async () => {
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-id' } });

      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'Math 101', 'quiz', '7');

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          courseName: 'Math 101',
          eventType: 'quiz',
          gcalCalendarId: 'new-id',
        })
      );
    });
  });

  describe('calendar naming convention', () => {
    it('creates calendar named "Canvas - Math 101 — Assignments" for (Math 101, assignment)', async () => {
      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'Math 101', 'assignment', '5');

      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - Math 101 — Assignments',
          }),
        })
      );
    });

    it('creates calendar named "Canvas - CS 201 — Quizzes" for (CS 201, quiz)', async () => {
      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'CS 201', 'quiz', '3');

      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - CS 201 — Quizzes',
          }),
        })
      );
    });

    it('creates calendar named "Canvas - ENG 100 — Events" for (ENG 100, event)', async () => {
      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'ENG 100', 'event', '2');

      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - ENG 100 — Events',
          }),
        })
      );
    });

    it('creates calendar named "Canvas - HIST 200 — Discussions" for (HIST 200, discussion)', async () => {
      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'HIST 200', 'discussion', '1');

      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - HIST 200 — Discussions',
          }),
        })
      );
    });

    it('creates calendar named "Canvas - BIO 301 — Announcements" for (BIO 301, announcement)', async () => {
      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'BIO 301', 'announcement', '9');

      expect(mockCalendarsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: 'Canvas - BIO 301 — Announcements',
          }),
        })
      );
    });
  });

  describe('colorId assignment', () => {
    it('calls calendarList.patch with the provided colorId', async () => {
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-cal-id' } });

      await ensureTypeSubCalendar(FAKE_CALENDAR, USER_ID, 'Math 101', 'assignment', '11');

      expect(mockCalendarListPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'new-cal-id',
          requestBody: expect.objectContaining({
            colorId: '11',
          }),
        })
      );
    });
  });

  describe('return value', () => {
    it('returns newly created calendarId on cache miss', async () => {
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'fresh-cal-id' } });

      const result = await ensureTypeSubCalendar(
        FAKE_CALENDAR,
        USER_ID,
        'Math 101',
        'assignment',
        '5'
      );

      expect(result).toBe('fresh-cal-id');
    });
  });
});

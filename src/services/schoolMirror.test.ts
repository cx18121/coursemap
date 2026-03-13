/**
 * Tests for schoolMirror.ts
 * - listSchoolCalendars: fetches and filters school account calendars
 * - mirrorSchoolCalendars: mirrors selected school calendars to personal account
 */

// Separate mock objects for school and personal calendar clients
const mockSchoolClient = {
  calendarList: {
    list: jest.fn(),
  },
  events: {
    list: jest.fn(),
  },
};

const mockPersonalClient = {
  calendars: {
    insert: jest.fn(),
  },
  events: {
    list: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
};

// Track which tokens are used for which clients
const tokenToClient: Record<string, object> = {};
const SCHOOL_TOKEN = 'school-access-token';
const PERSONAL_TOKEN = 'personal-access-token';

const mockSetCredentials = jest.fn().mockImplementation(function (this: { _token?: string }, creds: { access_token: string }) {
  this._token = creds.access_token;
});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(function (this: { _token?: string }) {
        this.setCredentials = function (creds: { access_token: string }) {
          this._token = creds.access_token;
        };
      }),
    },
    calendar: jest.fn().mockImplementation((opts: { version: string; auth: { _token?: string } }) => {
      const token = opts.auth._token;
      if (token === SCHOOL_TOKEN) {
        return mockSchoolClient;
      }
      return mockPersonalClient;
    }),
  },
}));

// Mock tokens
const mockGetFreshAccessToken = jest.fn();
jest.mock('@/lib/tokens', () => ({
  getFreshAccessToken: mockGetFreshAccessToken,
}));

// Mock db
const mockDbQuerySchoolSelectionsFindMany = jest.fn();
const mockDbUpdate = jest.fn();
const mockDbSet = jest.fn();
const mockDbWhere = jest.fn();

const mockDb = {
  query: {
    schoolCalendarSelections: {
      findMany: mockDbQuerySchoolSelectionsFindMany,
    },
  },
  update: mockDbUpdate,
  set: mockDbSet,
  where: mockDbWhere,
};

mockDbUpdate.mockReturnValue({ set: mockDbSet });
mockDbSet.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockResolvedValue(undefined);

jest.mock('@/lib/db', () => ({
  db: mockDb,
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: unknown, val: unknown) => ({ col, val, type: 'eq' })),
  and: jest.fn((...args: unknown[]) => ({ args, type: 'and' })),
}));

jest.mock('@/lib/db/schema', () => ({
  schoolCalendarSelections: {
    userId: 'userId',
    schoolCalendarId: 'schoolCalendarId',
    gcalMirrorCalendarId: 'gcalMirrorCalendarId',
  },
}));

// Mock gcalSubcalendars to isolate schoolMirror logic
const mockEnsureMirrorSubCalendar = jest.fn();
jest.mock('./gcalSubcalendars', () => ({
  ensureMirrorSubCalendar: mockEnsureMirrorSubCalendar,
}));

import { listSchoolCalendars, mirrorSchoolCalendars } from './schoolMirror';

describe('schoolMirror', () => {
  const USER_ID = 99;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetFreshAccessToken.mockImplementation((userId: number, role: string) => {
      if (role === 'school') return Promise.resolve(SCHOOL_TOKEN);
      if (role === 'personal') return Promise.resolve(PERSONAL_TOKEN);
      return Promise.resolve(null);
    });

    mockEnsureMirrorSubCalendar.mockResolvedValue('mirror-cal-id');
    mockPersonalClient.calendars.insert.mockResolvedValue({ data: { id: 'mirror-cal-id' } });
    mockPersonalClient.events.insert.mockResolvedValue({ data: { id: 'new-event-id' } });
    mockPersonalClient.events.update.mockResolvedValue({ data: { id: 'updated-event-id' } });
    mockPersonalClient.events.list.mockResolvedValue({ data: { items: [] } });
    mockSchoolClient.events.list.mockResolvedValue({ data: { items: [] } });
    mockSchoolClient.calendarList.list.mockResolvedValue({ data: { items: [] } });
    mockDbQuerySchoolSelectionsFindMany.mockResolvedValue([]);
  });

  describe('listSchoolCalendars', () => {
    it('returns empty array when no school account is linked', async () => {
      mockGetFreshAccessToken.mockResolvedValue(null);
      const result = await listSchoolCalendars(USER_ID);
      expect(result).toEqual([]);
    });

    it('calls getFreshAccessToken with userId and "school" role', async () => {
      await listSchoolCalendars(USER_ID);
      expect(mockGetFreshAccessToken).toHaveBeenCalledWith(USER_ID, 'school');
    });

    it('filters out freeBusyReader calendars', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [
            { id: 'primary-cal', summary: 'Primary Calendar', accessRole: 'owner' },
            { id: 'freebusy-cal', summary: 'Free/Busy', accessRole: 'freeBusyReader' },
          ],
        },
      });

      const result = await listSchoolCalendars(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].calendarId).toBe('primary-cal');
    });

    it('filters out contacts group calendars', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [
            { id: 'primary-cal', summary: 'My Calendar', accessRole: 'owner' },
            {
              id: 'someuser#contacts@group.v.calendar.google.com',
              summary: 'Contacts birthdays',
              accessRole: 'reader',
            },
          ],
        },
      });

      const result = await listSchoolCalendars(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].calendarId).toBe('primary-cal');
    });

    it('filters out holiday and weather calendars', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [
            { id: 'work-cal', summary: 'Work', accessRole: 'owner' },
            {
              id: 'en.usa#holiday@group.v.calendar.google.com',
              summary: 'US Holidays',
              accessRole: 'reader',
            },
            {
              id: '#weather@group.v.calendar.google.com',
              summary: 'Weather',
              accessRole: 'reader',
            },
          ],
        },
      });

      const result = await listSchoolCalendars(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].calendarId).toBe('work-cal');
    });

    it('marks calendars as selected when found in DB with enabled=true', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [
            { id: 'cal-a', summary: 'Class Schedule', accessRole: 'owner' },
            { id: 'cal-b', summary: 'Events', accessRole: 'owner' },
          ],
        },
      });
      mockDbQuerySchoolSelectionsFindMany.mockResolvedValue([
        { schoolCalendarId: 'cal-a', enabled: true },
      ]);

      const result = await listSchoolCalendars(USER_ID);

      const calA = result.find((c) => c.calendarId === 'cal-a');
      const calB = result.find((c) => c.calendarId === 'cal-b');
      expect(calA?.selected).toBe(true);
      // New calendars not yet in DB default to true (auto-include)
      expect(calB?.selected).toBe(true);
    });

    it('marks calendars as unselected when found in DB with enabled=false', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [{ id: 'cal-a', summary: 'Class Schedule', accessRole: 'owner' }],
        },
      });
      mockDbQuerySchoolSelectionsFindMany.mockResolvedValue([
        { schoolCalendarId: 'cal-a', enabled: false },
      ]);

      const result = await listSchoolCalendars(USER_ID);
      expect(result[0].selected).toBe(false);
    });

    it('returns SchoolCalendar objects with correct shape', async () => {
      mockSchoolClient.calendarList.list.mockResolvedValue({
        data: {
          items: [{ id: 'cal-1', summary: 'My Classes', accessRole: 'owner' }],
        },
      });

      const result = await listSchoolCalendars(USER_ID);

      expect(result[0]).toMatchObject({
        calendarId: 'cal-1',
        name: 'My Classes',
        selected: true,
      });
    });
  });

  describe('mirrorSchoolCalendars', () => {
    const selectedCalendars = [
      {
        id: 1,
        userId: USER_ID,
        schoolCalendarId: 'school-cal-1',
        schoolCalendarName: 'Class Schedule',
        enabled: true,
        gcalMirrorCalendarId: null,
      },
    ];

    beforeEach(() => {
      mockDbQuerySchoolSelectionsFindMany.mockResolvedValue(selectedCalendars);
    });

    it('returns empty summary when no school token available', async () => {
      mockGetFreshAccessToken.mockImplementation((userId: number, role: string) => {
        if (role === 'school') return Promise.resolve(null);
        return Promise.resolve(PERSONAL_TOKEN);
      });

      const summary = await mirrorSchoolCalendars(USER_ID);
      expect(summary.inserted).toBe(0);
      expect(summary.failed).toBe(0);
    });

    it('returns empty summary when no personal token available', async () => {
      mockGetFreshAccessToken.mockImplementation((userId: number, role: string) => {
        if (role === 'school') return Promise.resolve(SCHOOL_TOKEN);
        return Promise.resolve(null);
      });

      const summary = await mirrorSchoolCalendars(USER_ID);
      expect(summary.inserted).toBe(0);
    });

    it('only mirrors calendars with enabled=true', async () => {
      mockDbQuerySchoolSelectionsFindMany.mockResolvedValue([
        { ...selectedCalendars[0], enabled: true },
        {
          id: 2,
          userId: USER_ID,
          schoolCalendarId: 'school-cal-2',
          schoolCalendarName: 'Hidden',
          enabled: false,
          gcalMirrorCalendarId: null,
        },
      ]);

      await mirrorSchoolCalendars(USER_ID);

      // ensureMirrorSubCalendar should only be called once (for the enabled calendar)
      expect(mockEnsureMirrorSubCalendar).toHaveBeenCalledTimes(1);
      expect(mockEnsureMirrorSubCalendar).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        'school-cal-1',
        'Class Schedule'
      );
    });

    it('copies school events to mirror sub-calendar with dedup via schoolEventId', async () => {
      const schoolEvent = {
        id: 'school-event-id-1',
        summary: 'CS 201 Lecture',
        description: 'Chapter 5',
        start: { dateTime: '2026-04-01T09:00:00Z' },
        end: { dateTime: '2026-04-01T10:00:00Z' },
      };

      mockSchoolClient.events.list.mockResolvedValue({ data: { items: [schoolEvent] } });
      mockPersonalClient.events.list.mockResolvedValue({ data: { items: [] } });

      const summary = await mirrorSchoolCalendars(USER_ID);

      expect(mockPersonalClient.events.insert).toHaveBeenCalledTimes(1);
      expect(mockPersonalClient.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            extendedProperties: expect.objectContaining({
              private: expect.objectContaining({
                schoolEventId: 'school-event-id-1',
              }),
            }),
          }),
        })
      );
      expect(summary.inserted).toBe(1);
    });

    it('skips already-mirrored events (dedup by schoolEventId)', async () => {
      const schoolEvent = {
        id: 'school-event-id-1',
        summary: 'Existing Lecture',
        description: 'Already synced',
        start: { dateTime: '2026-04-01T09:00:00Z' },
        end: { dateTime: '2026-04-01T10:00:00Z' },
      };

      mockSchoolClient.events.list.mockResolvedValue({ data: { items: [schoolEvent] } });
      mockPersonalClient.events.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'mirror-event-id',
              summary: 'Existing Lecture',
              start: { dateTime: '2026-04-01T09:00:00Z' },
              end: { dateTime: '2026-04-01T10:00:00Z' },
              description: 'Already synced',
              extendedProperties: {
                private: { schoolEventId: 'school-event-id-1' },
              },
            },
          ],
        },
      });

      const summary = await mirrorSchoolCalendars(USER_ID);

      expect(mockPersonalClient.events.insert).not.toHaveBeenCalled();
      expect(summary.skipped).toBe(1);
    });

    it('does NOT modify school event titles (preserved as-is)', async () => {
      const originalTitle = 'CS 201-001 Lecture [Spring 2026] - Prof. Smith';
      const schoolEvent = {
        id: 'event-1',
        summary: originalTitle,
        description: 'No title cleanup',
        start: { dateTime: '2026-04-01T09:00:00Z' },
        end: { dateTime: '2026-04-01T10:00:00Z' },
      };

      mockSchoolClient.events.list.mockResolvedValue({ data: { items: [schoolEvent] } });
      mockPersonalClient.events.list.mockResolvedValue({ data: { items: [] } });

      await mirrorSchoolCalendars(USER_ID);

      const insertCall = mockPersonalClient.events.insert.mock.calls[0][0];
      expect(insertCall.requestBody.summary).toBe(originalTitle);
    });

    it('returns accurate MirrorSummary counts', async () => {
      const schoolEvents = [
        {
          id: 'ev-new',
          summary: 'New Event',
          start: { dateTime: '2026-04-01T09:00:00Z' },
          end: { dateTime: '2026-04-01T10:00:00Z' },
          description: '',
        },
        {
          id: 'ev-existing',
          summary: 'Same Event',
          start: { dateTime: '2026-04-02T09:00:00Z' },
          end: { dateTime: '2026-04-02T10:00:00Z' },
          description: 'desc',
        },
        {
          id: 'ev-changed',
          summary: 'Changed Event Title',
          start: { dateTime: '2026-04-03T09:00:00Z' },
          end: { dateTime: '2026-04-03T10:00:00Z' },
          description: '',
        },
      ];

      mockSchoolClient.events.list.mockResolvedValue({ data: { items: schoolEvents } });
      mockPersonalClient.events.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'mirror-existing',
              summary: 'Same Event',
              start: { dateTime: '2026-04-02T09:00:00Z' },
              end: { dateTime: '2026-04-02T10:00:00Z' },
              description: 'desc',
              extendedProperties: { private: { schoolEventId: 'ev-existing' } },
            },
            {
              id: 'mirror-changed',
              summary: 'Old Title',
              start: { dateTime: '2026-04-03T09:00:00Z' },
              end: { dateTime: '2026-04-03T10:00:00Z' },
              description: '',
              extendedProperties: { private: { schoolEventId: 'ev-changed' } },
            },
          ],
        },
      });

      const summary = await mirrorSchoolCalendars(USER_ID);

      expect(summary.inserted).toBe(1);
      expect(summary.updated).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.failed).toBe(0);
    });
  });
});

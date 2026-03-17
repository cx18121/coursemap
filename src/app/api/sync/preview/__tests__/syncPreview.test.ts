// Mock heavy dependencies before importing the route
jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));
jest.mock('@/lib/db', () => {
  const mockFindFirst = jest.fn();
  const mockFindMany = jest.fn();
  return {
    db: {
      query: {
        users: { findFirst: mockFindFirst },
        syncedEvents: { findMany: mockFindMany },
      },
    },
    __mockFindFirst: mockFindFirst,
    __mockFindMany: mockFindMany,
  };
});
jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id' },
  syncedEvents: { userId: 'userId' },
}));
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));
jest.mock('@/services/icalParser', () => ({
  parseCanvasFeed: jest.fn(),
}));
jest.mock('@/services/syncFilter', () => ({
  filterEventsForSync: jest.fn(),
}));
jest.mock('@/services/gcalSync', () => ({
  loadCourseTypeSettings: jest.fn(),
}));

import { GET } from '../route';
import { getSession } from '@/lib/session';
import { db, __mockFindFirst, __mockFindMany } from '@/lib/db';
import { parseCanvasFeed } from '@/services/icalParser';
import { filterEventsForSync } from '@/services/syncFilter';
import { loadCourseTypeSettings } from '@/services/gcalSync';

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = (__mockFindFirst as any) as jest.MockedFunction<() => Promise<unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = (__mockFindMany as any) as jest.MockedFunction<() => Promise<unknown>>;
const mockParseCanvasFeed = parseCanvasFeed as jest.MockedFunction<typeof parseCanvasFeed>;
const mockFilterEventsForSync = filterEventsForSync as jest.MockedFunction<typeof filterEventsForSync>;
const mockLoadCourseTypeSettings = loadCourseTypeSettings as jest.MockedFunction<typeof loadCourseTypeSettings>;

function makeCanvasEvent(overrides: Partial<{
  uid: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  courseName: string;
  eventType: string;
  cleanedTitle: string;
}> = {}) {
  return {
    uid: 'event-uid-1',
    summary: 'Assignment 1',
    description: 'Do the thing',
    start: new Date('2026-04-01T10:00:00Z'),
    end: new Date('2026-04-01T11:00:00Z'),
    courseName: 'CS101',
    eventType: 'Assignments',
    cleanedTitle: 'Assignment 1',
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<{
  uid: string;
  summary: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  gcalCalendarId: string;
}> = {}) {
  return {
    uid: 'event-uid-1',
    summary: 'Assignment 1',
    description: 'Do the thing',
    startAt: new Date('2026-04-01T10:00:00Z'),
    endAt: new Date('2026-04-01T11:00:00Z'),
    gcalCalendarId: 'cal-id-1',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/sync/preview', () => {
  test('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns zeros when user has no canvasIcsUrl', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue({ id: 42, canvasIcsUrl: null });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 0 });
  });

  test('returns wouldCreate > 0 when Canvas has events not in mirror', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue({ id: 42, canvasIcsUrl: 'https://canvas.example.com/feed.ics' });

    const event1 = makeCanvasEvent({ uid: 'uid-1' });
    const event2 = makeCanvasEvent({ uid: 'uid-2', summary: 'Assignment 2' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockParseCanvasFeed.mockResolvedValue({ CS101: [event1, event2] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFilterEventsForSync.mockResolvedValue([event1, event2] as any);
    mockLoadCourseTypeSettings.mockResolvedValue(new Map());
    mockFindMany.mockResolvedValue([]); // empty mirror

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ wouldCreate: 2, wouldUpdate: 0, wouldSkip: 0 });
  });

  test('returns wouldUpdate > 0 when mirror has stale summary', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue({ id: 42, canvasIcsUrl: 'https://canvas.example.com/feed.ics' });

    const event = makeCanvasEvent({ summary: 'Assignment 1 Updated' });
    const snapshot = makeSnapshot({ summary: 'Assignment 1 Old' }); // stale summary

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockParseCanvasFeed.mockResolvedValue({ CS101: [event] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFilterEventsForSync.mockResolvedValue([event] as any);
    mockLoadCourseTypeSettings.mockResolvedValue(new Map());
    mockFindMany.mockResolvedValue([snapshot]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ wouldCreate: 0, wouldUpdate: 1, wouldSkip: 0 });
  });

  test('returns wouldSkip > 0 when mirror matches exactly', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue({ id: 42, canvasIcsUrl: 'https://canvas.example.com/feed.ics' });

    const event = makeCanvasEvent();
    const snapshot = makeSnapshot(); // identical to event

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockParseCanvasFeed.mockResolvedValue({ CS101: [event] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFilterEventsForSync.mockResolvedValue([event] as any);
    mockLoadCourseTypeSettings.mockResolvedValue(new Map());
    mockFindMany.mockResolvedValue([snapshot]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 1 });
  });

  test('excludes events from disabled type settings', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue({ id: 42, canvasIcsUrl: 'https://canvas.example.com/feed.ics' });

    const event1 = makeCanvasEvent({ uid: 'uid-1', eventType: 'Assignments' });
    const event2 = makeCanvasEvent({ uid: 'uid-2', eventType: 'Quizzes' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockParseCanvasFeed.mockResolvedValue({ CS101: [event1, event2] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFilterEventsForSync.mockResolvedValue([event1, event2] as any);

    // Quizzes are disabled for CS101
    const cs101Map = new Map([
      ['Assignments', { enabled: true, colorId: '9' }],
      ['Quizzes', { enabled: false, colorId: '11' }],
    ]);
    mockLoadCourseTypeSettings.mockResolvedValue(new Map([['CS101', cs101Map]]));
    mockFindMany.mockResolvedValue([]); // empty mirror — both would create if not filtered

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    // Only event1 (Assignments) passes the type filter
    expect(body).toEqual({ wouldCreate: 1, wouldUpdate: 0, wouldSkip: 0 });
  });

  test('returns wouldCreate when user has undefined canvasIcsUrl field missing', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    // Simulate user row with undefined canvasIcsUrl
    mockFindFirst.mockResolvedValue(undefined);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ wouldCreate: 0, wouldUpdate: 0, wouldSkip: 0 });
  });
});

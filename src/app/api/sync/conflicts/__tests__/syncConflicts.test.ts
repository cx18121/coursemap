/**
 * Tests for GET /api/sync/conflicts
 * Validates conflict detection logic: grace window filtering, null gcalEventId skipping,
 * deleted event handling, and authentication guards.
 */

// ---- Mock googleapis before any imports ----

const mockEventsGet = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        get: mockEventsGet,
      },
    }),
  },
}));

// ---- Mock @/lib/session ----

const mockGetSession = jest.fn();
jest.mock('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// ---- Mock @/lib/tokens ----

const mockGetFreshAccessToken = jest.fn();
jest.mock('@/lib/tokens', () => ({
  getFreshAccessToken: mockGetFreshAccessToken,
}));

// ---- Mock @/lib/db ----

const mockFindMany = jest.fn();
const mockDb = {
  query: {
    syncedEvents: {
      findMany: mockFindMany,
    },
  },
};
jest.mock('@/lib/db', () => ({
  db: mockDb,
}));

// ---- Mock drizzle-orm operators ----

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: unknown, val: unknown) => ({ col, val, type: 'eq' })),
  and: jest.fn((...args: unknown[]) => ({ args, type: 'and' })),
  isNotNull: jest.fn((col: unknown) => ({ col, type: 'isNotNull' })),
}));

// ---- Mock @/lib/db/schema ----

jest.mock('@/lib/db/schema', () => ({
  syncedEvents: {
    userId: 'userId',
    uid: 'uid',
    summary: 'summary',
    description: 'description',
    startAt: 'startAt',
    endAt: 'endAt',
    gcalCalendarId: 'gcalCalendarId',
    gcalEventId: 'gcalEventId',
    syncedAt: 'syncedAt',
  },
}));

// ---- Import the route under test ----

import { GET } from '../route';

// ---- Test constants ----

const GRACE_MS = 60_000;
const NOW = new Date('2026-04-01T12:00:00Z');
const SYNCED_AT = new Date(NOW.getTime() - 300_000); // 5 minutes ago

const BASE_ROW = {
  uid: 'uid-1',
  summary: 'HW1',
  description: null,
  startAt: new Date('2026-04-05T10:00:00Z'),
  endAt: new Date('2026-04-05T11:00:00Z'),
  gcalCalendarId: 'cal-abc',
  gcalEventId: 'gcal-123',
  syncedAt: SYNCED_AT,
};

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks();
  // Default: valid session + valid token + empty rows
  mockGetSession.mockResolvedValue({ userId: 42 });
  mockGetFreshAccessToken.mockResolvedValue('fake-token');
  mockFindMany.mockResolvedValue([]);
});

describe('GET /api/sync/conflicts', () => {
  // Test 1: Returns 401 when session is missing
  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // Test 2: Returns empty result when user has no syncedEvents rows
  it('returns { conflictCount: 0, conflicts: [] } when user has no rows', async () => {
    mockFindMany.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ conflictCount: 0, conflicts: [] });
  });

  // Test 3: Rows with null gcalEventId are filtered out (not treated as conflicts)
  it('skips rows with null gcalEventId and returns empty conflicts', async () => {
    mockFindMany.mockResolvedValue([
      { ...BASE_ROW, gcalEventId: null },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ conflictCount: 0, conflicts: [] });
    // events.get should NOT be called since the WHERE filter excludes null gcalEventIds
    expect(mockEventsGet).not.toHaveBeenCalled();
  });

  // Test 4: Detects conflict when GCal updated > syncedAt + GRACE_MS
  it('detects conflict when GCal event was updated 90s after syncedAt', async () => {
    mockFindMany.mockResolvedValue([BASE_ROW]);

    const gcalUpdated = new Date(SYNCED_AT.getTime() + GRACE_MS + 30_000).toISOString(); // 90s after syncedAt
    mockEventsGet.mockResolvedValue({
      data: { updated: gcalUpdated },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conflictCount).toBe(1);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toMatchObject({
      uid: 'uid-1',
      summary: 'HW1',
      startAt: '2026-04-05T10:00:00.000Z',
      gcalUpdatedAt: gcalUpdated,
    });
  });

  // Test 5: Does NOT flag conflict when GCal updated is within grace window (30s after syncedAt)
  it('does not flag conflict when GCal update is within grace window', async () => {
    mockFindMany.mockResolvedValue([BASE_ROW]);

    const gcalUpdated = new Date(SYNCED_AT.getTime() + 30_000).toISOString(); // 30s after syncedAt — within grace
    mockEventsGet.mockResolvedValue({
      data: { updated: gcalUpdated },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ conflictCount: 0, conflicts: [] });
  });

  // Test 6: Skips events where events.get throws (deleted/inaccessible event)
  it('skips deleted events that throw on events.get', async () => {
    mockFindMany.mockResolvedValue([
      { ...BASE_ROW, gcalEventId: 'gcal-deleted' },
    ]);
    mockEventsGet.mockRejectedValue(new Error('Not Found'));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ conflictCount: 0, conflicts: [] });
  });

  // Test 7: Returns 401 when getFreshAccessToken returns null
  it('returns 401 when getFreshAccessToken returns null', async () => {
    mockFindMany.mockResolvedValue([BASE_ROW]);
    mockGetFreshAccessToken.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

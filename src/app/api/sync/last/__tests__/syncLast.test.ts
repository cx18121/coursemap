// Mock heavy dependencies before importing the route
jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));
jest.mock('@/lib/db', () => {
  const mockFindFirst = jest.fn();
  return {
    db: { query: { syncLog: { findFirst: mockFindFirst } } },
    __mockFindFirst: mockFindFirst,
  };
});
jest.mock('@/lib/db/schema', () => ({
  syncLog: { userId: 'userId' },
}));
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

import { GET } from '../route';
import { getSession } from '@/lib/session';
import { db, __mockFindFirst } from '@/lib/db';

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = (__mockFindFirst as any) as jest.MockedFunction<() => Promise<unknown>>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/sync/last', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns null values when no syncLog row exists', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    mockFindFirst.mockResolvedValue(undefined);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.lastSyncedAt).toBeNull();
    expect(body.lastSyncStatus).toBeNull();
    expect(body.lastSyncError).toBeNull();
  });

  test('returns lastSyncedAt ISO string and status when row exists', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    const syncDate = new Date('2026-03-16T06:00:00.000Z');
    mockFindFirst.mockResolvedValue({
      lastSyncedAt: syncDate,
      lastSyncStatus: 'success',
      lastSyncError: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.lastSyncedAt).toBe('2026-03-16T06:00:00.000Z');
    expect(body.lastSyncStatus).toBe('success');
    expect(body.lastSyncError).toBeNull();
  });

  test('returns lastSyncError when status is error', async () => {
    mockGetSession.mockResolvedValue({ userId: 42, exp: 9999999999 });
    const syncDate = new Date('2026-03-16T06:00:00.000Z');
    mockFindFirst.mockResolvedValue({
      lastSyncedAt: syncDate,
      lastSyncStatus: 'error',
      lastSyncError: 'Your Google account connection has expired.',
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.lastSyncStatus).toBe('error');
    expect(body.lastSyncError).toBe('Your Google account connection has expired.');
  });
});

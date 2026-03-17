// Mock heavy dependencies before importing the route
jest.mock('@/lib/db', () => {
  const mockWhere = jest.fn();
  const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });
  return {
    db: { select: mockSelect },
    __mockWhere: mockWhere,
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
  };
});
jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', canvasIcsUrl: 'canvasIcsUrl' },
}));
jest.mock('drizzle-orm', () => ({
  isNotNull: jest.fn((col) => ({ isNotNull: col })),
}));
jest.mock('@/lib/syncRunner', () => ({
  runSyncForUser: jest.fn(),
  upsertSyncLog: jest.fn(),
}));
jest.mock('@/app/api/sync/route', () => ({
  classifyError: jest.fn((err: unknown) =>
    err instanceof Error ? err.message : String(err)
  ),
}));

import { GET } from '../route';
import { runSyncForUser, upsertSyncLog } from '@/lib/syncRunner';
import { db, __mockWhere } from '@/lib/db';

const mockRunSyncForUser = runSyncForUser as jest.MockedFunction<typeof runSyncForUser>;
const mockUpsertSyncLog = upsertSyncLog as jest.MockedFunction<typeof upsertSyncLog>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWhere = (__mockWhere as any) as jest.MockedFunction<() => Promise<unknown[]>>;

function makeRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) => (name === 'authorization' ? (authHeader ?? null) : null),
    },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';
  mockUpsertSyncLog.mockResolvedValue(undefined);
  mockRunSyncForUser.mockResolvedValue({
    canvasSummary: { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
    mirrorSummary: { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
  });
  mockWhere.mockResolvedValue([]);
});

describe('GET /api/cron/sync', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  test('returns 401 when Authorization header has wrong token', async () => {
    const res = await GET(makeRequest('Bearer wrong-token'));
    expect(res.status).toBe(401);
  });

  test('calls runSyncForUser for each user with canvasIcsUrl', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' },
      { id: 2, canvasIcsUrl: 'https://canvas.example.com/2.ics' },
    ]);

    const res = await GET(makeRequest('Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(mockRunSyncForUser).toHaveBeenCalledTimes(2);
    expect(mockRunSyncForUser).toHaveBeenCalledWith(1, 'https://canvas.example.com/1.ics');
    expect(mockRunSyncForUser).toHaveBeenCalledWith(2, 'https://canvas.example.com/2.ics');
  });

  test('users without canvasIcsUrl are not returned by the query (filtering is in DB)', async () => {
    // DB query only returns users with canvasIcsUrl — verify we only process what's returned
    mockWhere.mockResolvedValue([{ id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' }]);

    await GET(makeRequest('Bearer test-secret'));
    expect(mockRunSyncForUser).toHaveBeenCalledTimes(1);
    expect(mockRunSyncForUser).toHaveBeenCalledWith(1, 'https://canvas.example.com/1.ics');
  });

  test('when user 1 throws, user 2 still runs (per-user error isolation)', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' },
      { id: 2, canvasIcsUrl: 'https://canvas.example.com/2.ics' },
    ]);
    mockRunSyncForUser
      .mockRejectedValueOnce(new Error('token expired'))
      .mockResolvedValueOnce({
        canvasSummary: { inserted: 1, updated: 0, skipped: 0, failed: 0, errors: [] },
        mirrorSummary: { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
      });

    const res = await GET(makeRequest('Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(mockRunSyncForUser).toHaveBeenCalledTimes(2);

    const body = await res.json();
    expect(body.ran).toBe(2);
    expect(body.results[0].status).toBe('error');
    expect(body.results[1].status).toBe('success');
  });

  test('on success: calls upsertSyncLog with success', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' },
    ]);

    await GET(makeRequest('Bearer test-secret'));
    expect(mockUpsertSyncLog).toHaveBeenCalledWith(1, 'success');
  });

  test('on error: calls upsertSyncLog with error and error message', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' },
    ]);
    mockRunSyncForUser.mockRejectedValueOnce(new Error('token expired'));

    await GET(makeRequest('Bearer test-secret'));
    expect(mockUpsertSyncLog).toHaveBeenCalledWith(1, 'error', 'token expired');
  });

  test('returns JSON with ran count and per-user results', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, canvasIcsUrl: 'https://canvas.example.com/1.ics' },
      { id: 2, canvasIcsUrl: 'https://canvas.example.com/2.ics' },
    ]);
    mockRunSyncForUser
      .mockResolvedValueOnce({
        canvasSummary: { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
        mirrorSummary: { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
      })
      .mockRejectedValueOnce(new Error('canvas 404'));

    const res = await GET(makeRequest('Bearer test-secret'));
    const body = await res.json();

    expect(body.ran).toBe(2);
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toMatchObject({ userId: 1, status: 'success' });
    expect(body.results[1]).toMatchObject({ userId: 2, status: 'error' });
  });
});

/**
 * Unit tests for school OAuth callback handler
 * src/app/link/school-google/callback/route.ts
 */

// ---- Mock arctic ----
const mockValidateAuthorizationCode = jest.fn();
const mockDecodeIdToken = jest.fn();

jest.mock("arctic", () => ({
  Google: jest.fn().mockImplementation(() => ({
    validateAuthorizationCode: mockValidateAuthorizationCode,
    createAuthorizationURL: jest.fn(),
  })),
  decodeIdToken: mockDecodeIdToken,
  generateState: jest.fn().mockReturnValue("state-value"),
  generateCodeVerifier: jest.fn().mockReturnValue("verifier-value"),
}));

// ---- Mock next/headers ----
let mockCookies: Record<string, string> = {};
const mockCookieStore = {
  get: jest.fn((name: string) =>
    mockCookies[name] ? { value: mockCookies[name] } : undefined
  ),
  set: jest.fn(),
  delete: jest.fn(),
};
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}));

// ---- Mock session ----
const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({
  getSession: mockGetSession,
  setSessionCookie: jest.fn(),
  clearSessionCookie: jest.fn(),
}));

// ---- Mock db ----
const mockFindFirst = jest.fn();
const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
const mockInsertValues = jest.fn().mockReturnValue({
  onConflictDoUpdate: mockOnConflictDoUpdate,
});
const mockInsert = jest.fn().mockReturnValue({ values: mockInsertValues });

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      oauthTokens: { findFirst: mockFindFirst },
      users: { findFirst: jest.fn() },
    },
    insert: mockInsert,
    delete: jest.fn().mockReturnValue({ where: jest.fn() }),
  },
}));

// ---- Mock tokens ----
jest.mock("@/lib/tokens", () => ({
  encryptToken: jest.fn((val: string) => `enc:${val}`),
  decryptToken: jest.fn((val: string) => val.replace("enc:", "")),
}));

// ---- Import handler AFTER mocks are set up ----
import { GET } from "../school-google/callback/route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/link/school-google/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function mockTokens(hasRefresh = true) {
  return {
    accessToken: jest.fn().mockReturnValue("access-token-value"),
    accessTokenExpiresAt: jest.fn().mockReturnValue(new Date("2099-01-01")),
    hasRefreshToken: jest.fn().mockReturnValue(hasRefresh),
    refreshToken: jest.fn().mockReturnValue("refresh-token-value"),
    idToken: jest.fn().mockReturnValue("id-token-value"),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCookies = {
    link_oauth_state: "test-state",
    link_code_verifier: "test-verifier",
  };
  mockCookieStore.get.mockImplementation((name: string) =>
    mockCookies[name] ? { value: mockCookies[name] } : undefined
  );
  mockDecodeIdToken.mockReturnValue({
    sub: "school-123",
    email: "student@school.edu",
    name: "Test Student",
  });
  mockGetSession.mockResolvedValue({ userId: 1, exp: 9999999999 });
  mockValidateAuthorizationCode.mockResolvedValue(mockTokens());
  mockFindFirst.mockResolvedValue(null);
});

describe("GET /link/school-google/callback", () => {
  test("inserts oauthTokens row with role=school and school email, does NOT insert into users", async () => {
    const req = makeRequest({ code: "auth-code", state: "test-state" });
    const res = await GET(req);

    // Verify it redirects (not 200)
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http/);

    // Verify insert into oauthTokens was called with role=school
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedValues = mockInsertValues.mock.calls[0][0];
    expect(insertedValues.role).toBe("school");
    expect(insertedValues.email).toBe("student@school.edu");
    expect(insertedValues.userId).toBe(1);
    expect(insertedValues.encryptedAccessToken).toBe("enc:access-token-value");

    // Verify NO insert into users table was made (only one insert call total)
    const allInsertTargets = mockInsert.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    // The import target is the oauthTokens table object — users table should not appear
    // We verify by checking there's exactly 1 insert call total
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // And the values contain role=school (not a users insert which has googleId)
    expect(insertedValues.role).toBeDefined();
    expect(allInsertTargets).toHaveLength(1);
  });

  test("redirects to / on success", async () => {
    const req = makeRequest({ code: "auth-code", state: "test-state" });
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/");
  });

  test("redirects to / if no valid session (session guard)", async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest({ code: "auth-code", state: "test-state" });
    const res = await GET(req);
    // Should redirect (not 200), and NOT to /?error — just back to /
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/");
    // And no insert should happen
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test("redirects to /?error=school_access_denied when error query param present", async () => {
    const req = makeRequest({ error: "access_denied" });
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=school_access_denied");
  });

  test("cleans up link_ cookies after successful callback", async () => {
    const req = makeRequest({ code: "auth-code", state: "test-state" });
    await GET(req);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("link_oauth_state");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("link_code_verifier");
  });

  test("preserves existing refresh token when Google does not return a new one", async () => {
    const tokensNoRefresh = mockTokens(false);
    mockValidateAuthorizationCode.mockResolvedValue(tokensNoRefresh);
    mockFindFirst.mockResolvedValue({
      encryptedRefreshToken: "enc:existing-refresh-token",
    });

    const req = makeRequest({ code: "auth-code", state: "test-state" });
    await GET(req);

    const insertedValues = mockInsertValues.mock.calls[0][0];
    expect(insertedValues.encryptedRefreshToken).toBe(
      "enc:existing-refresh-token"
    );
  });
});

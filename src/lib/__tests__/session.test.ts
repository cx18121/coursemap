import crypto from "crypto";

// Set up SESSION_SECRET before importing the module
beforeAll(() => {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
});

let encryptSession: (payload: { userId: number }) => Promise<string>;
let decryptSession: (token: string) => Promise<{ userId: number; exp: number } | null>;

beforeAll(async () => {
  const mod = await import("../session");
  encryptSession = mod.encryptSession;
  decryptSession = mod.decryptSession;
});

describe("encryptSession / decryptSession", () => {
  test("round-trip: encrypt then decrypt returns object with correct userId", async () => {
    const token = await encryptSession({ userId: 42 });
    const result = await decryptSession(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(42);
  });

  test("decryptSession with garbage string returns null (does not throw)", async () => {
    const result = await decryptSession("this-is-not-a-valid-jwt");
    expect(result).toBeNull();
  });

  test("decryptSession with empty string returns null", async () => {
    const result = await decryptSession("");
    expect(result).toBeNull();
  });

  test("decryptSession with malformed JWT returns null", async () => {
    const result = await decryptSession("header.payload.signature");
    expect(result).toBeNull();
  });

  test("encrypted session contains exp field", async () => {
    const token = await encryptSession({ userId: 99 });
    const result = await decryptSession(token);
    expect(result).not.toBeNull();
    expect(result!.exp).toBeDefined();
    expect(typeof result!.exp).toBe("number");
    // Should expire in the future
    expect(result!.exp).toBeGreaterThan(Date.now() / 1000);
  });
});

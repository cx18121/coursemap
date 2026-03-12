import crypto from "crypto";

// Mock db and auth modules so tokens.ts can be imported without real DB/OAuth clients
jest.mock("@/lib/db", () => ({
  db: {
    query: { oauthTokens: { findFirst: jest.fn() } },
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn() }) }),
  },
}));
jest.mock("@/lib/auth", () => ({
  googleClient: { refreshAccessToken: jest.fn() },
  googleSchoolClient: { createAuthorizationURL: jest.fn() },
  generateState: jest.fn(),
  generateCodeVerifier: jest.fn(),
}));

// Set up TOKEN_ENCRYPTION_KEY before importing the module
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

// Dynamic import to pick up env var set in beforeAll
let encryptToken: (plaintext: string) => string;
let decryptToken: (stored: string) => string;

beforeAll(async () => {
  const mod = await import("../tokens");
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
});

describe("encryptToken / decryptToken", () => {
  test("round-trip: encrypt then decrypt returns original plaintext", () => {
    const original = "ya29.access-token-value";
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  test("encrypt produces format base64:base64:base64 (iv:tag:ciphertext)", () => {
    const encrypted = encryptToken("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be non-empty valid base64
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });

  test("tampered ciphertext throws an error", () => {
    const encrypted = encryptToken("sensitive-token");
    const parts = encrypted.split(":");
    // Tamper the ciphertext (last segment)
    const tampered = parts[0] + ":" + parts[1] + ":AAAAAAAAAAAAAAAAAAAAAAAA";
    expect(() => decryptToken(tampered)).toThrow();
  });

  test("different encryptions of same plaintext produce different ciphertexts (random IV)", () => {
    const enc1 = encryptToken("same-value");
    const enc2 = encryptToken("same-value");
    expect(enc1).not.toBe(enc2);
  });
});

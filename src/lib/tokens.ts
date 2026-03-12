import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { googleClient } from "@/lib/auth";

// KEY is 32 bytes (256 bits) base64-encoded
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64");

/**
 * Encrypt a plaintext token string using AES-256-GCM.
 * Returns a colon-separated string: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a token previously encrypted with encryptToken.
 * Throws if the ciphertext has been tampered with (authentication failure).
 */
export function decryptToken(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

/**
 * Get a fresh access token for the given user and role.
 * - Returns the existing token if it expires more than 5 minutes in the future.
 * - Refreshes via Google OAuth if the token is expired (or within 5 min of expiry).
 * - Returns null if no token row exists, refresh token is missing, or refresh fails.
 * Callers should show a ReconnectBanner when null is returned.
 */
export async function getFreshAccessToken(
  userId: number,
  role: "personal" | "school"
): Promise<string | null> {
  const row = await db.query.oauthTokens.findFirst({
    where: and(eq(oauthTokens.userId, userId), eq(oauthTokens.role, role)),
  });

  if (!row) return null;

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // Return cached token if it won't expire within 5 minutes
  if (row.accessTokenExpiresAt > fiveMinutesFromNow) {
    return decryptToken(row.encryptedAccessToken);
  }

  // Token is expired or expiring soon — attempt to refresh
  if (!row.encryptedRefreshToken) {
    // No refresh token stored — user must re-authenticate
    return null;
  }

  try {
    const refreshToken = decryptToken(row.encryptedRefreshToken);
    const newTokens = await googleClient.refreshAccessToken(refreshToken);

    const newEncryptedAccessToken = encryptToken(newTokens.accessToken());
    const newExpiresAt = newTokens.accessTokenExpiresAt();

    // Update the DB row with the new access token
    await db
      .update(oauthTokens)
      .set({
        encryptedAccessToken: newEncryptedAccessToken,
        accessTokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.role, role)));

    return newTokens.accessToken();
  } catch {
    // Refresh failed — caller shows ReconnectBanner
    return null;
  }
}

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = "session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Create an encrypted session JWT containing the userId payload.
 */
export async function encryptSession(payload: {
  userId: number;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

/**
 * Verify and decrypt a session JWT.
 * Returns null if the token is invalid, expired, or tampered with (never throws).
 */
export async function decryptSession(
  token: string
): Promise<{ userId: number; exp: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      algorithms: ["HS256"],
    });
    return payload as { userId: number; exp: number };
  } catch {
    return null;
  }
}

/**
 * Set the session cookie for the given userId.
 * Requires a Next.js request context (Route Handler or Server Component).
 */
export async function setSessionCookie(userId: number): Promise<void> {
  const token = await encryptSession({ userId });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Read and verify the session cookie.
 * Returns null if no session or if the session is invalid/expired.
 * Requires a Next.js request context.
 */
export async function getSession(): Promise<{
  userId: number;
  exp: number;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decryptSession(token);
}

/**
 * Clear the session cookie.
 * Requires a Next.js request context.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

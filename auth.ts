import crypto from "crypto";

// Password hashing and session tokens for EduAdmin Pro.
//
// Uses only Node's built-in `crypto` (scrypt) — no native modules — so it builds
// and runs anywhere the app already runs, including the packaged Electron app.

const SCRYPT_KEYLEN = 64;

/** Hashes a plaintext password with a per-password random salt. Returns "salt:hash". */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

/** Constant-time verification of a plaintext password against a stored "salt:hash". */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  // Lengths must match before timingSafeEqual, which throws on mismatch.
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

/** Cryptographically-random opaque session token. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Session lifetime. Tokens older than this are rejected and swept. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function sessionExpiry(from: number = Date.now()): string {
  return new Date(from + SESSION_TTL_MS).toISOString();
}

export type Role = "admin" | "teacher";

/** Basic password policy — kept simple but non-trivial. */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

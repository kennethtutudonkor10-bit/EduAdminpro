import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Application-level field encryption for data at rest (AES-256-GCM).
 *
 * Only used for identifiable contact PII (phone numbers, photos, email) — fields
 * that are never used in SQL WHERE/JOIN/ORDER clauses, so encrypting them doesn't
 * break lookups or sorting. Values are self-describing: an encrypted value starts
 * with `enc:v1:`, so plaintext rows written before this feature still read back
 * unchanged (and are migrated in place on startup).
 *
 * Key source, in order:
 *   1. EDUADMIN_ENCRYPTION_KEY  — a secret you supply (e.g. from an OS keychain).
 *      Strongest: the key never touches the database directory.
 *   2. A generated key file in the data directory (mode 0600). Protects an
 *      exfiltrated/backed-up database file, but not an attacker with full disk
 *      access. Set EDUADMIN_ENCRYPTION_KEY for stronger protection.
 */

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

let key: Buffer | null = null;

export function initEncryption(userDataPath: string): void {
  const envKey = process.env.EDUADMIN_ENCRYPTION_KEY?.trim();
  if (envKey) {
    key = crypto.scryptSync(envKey, "eduadmin-field-encryption", 32);
    return;
  }
  const keyPath = path.join(userDataPath, ".enc_key");
  try {
    if (fs.existsSync(keyPath)) {
      const existing = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
      if (existing.length === 32) { key = existing; return; }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, generated.toString("hex"), { mode: 0o600 });
    key = generated;
  } catch {
    // Never crash the app over key storage; without a stable key, encrypted
    // values simply won't round-trip (surfaced as decrypt failures).
    key = key ?? crypto.randomBytes(32);
  }
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts a value for storage. Null/empty pass through; already-encrypted values are left as-is. */
export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return plain ?? null;
  if (!key || isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypts a stored value. Legacy plaintext (no prefix) is returned unchanged; tampered/undecryptable values return null. */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext
  if (!key) return null;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered ciphertext — fail closed
  }
}

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { initEncryption, encryptField, decryptField, isEncrypted } from "../crypto-store";

beforeAll(() => {
  initEncryption(fs.mkdtempSync(path.join(os.tmpdir(), "eduadmin-crypto-")));
});

describe("field encryption", () => {
  it("round-trips a value and hides the plaintext", () => {
    const enc = encryptField("0244123456");
    expect(enc).not.toBeNull();
    expect(isEncrypted(enc!)).toBe(true);
    expect(enc).not.toContain("0244123456");
    expect(decryptField(enc)).toBe("0244123456");
  });

  it("passes through null and empty values", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField("")).toBe("");
    expect(decryptField(null)).toBeNull();
  });

  it("reads legacy plaintext unchanged", () => {
    expect(decryptField("legacy-plain")).toBe("legacy-plain");
  });

  it("does not double-encrypt", () => {
    const once = encryptField("x")!;
    expect(encryptField(once)).toBe(once);
  });

  it("fails closed on tampered ciphertext", () => {
    const enc = encryptField("secret")!;
    expect(decryptField(enc.slice(0, -3) + "AAA")).toBeNull();
  });

  it("uses a random IV (distinct ciphertext each time)", () => {
    expect(encryptField("same")).not.toBe(encryptField("same"));
  });
});

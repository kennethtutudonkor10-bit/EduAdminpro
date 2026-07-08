import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePassword, generateToken } from "../auth";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("uses a unique salt per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("requires at least 8 characters", () => {
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("longenough")).toBeNull();
  });
});

describe("session tokens", () => {
  it("generates unique 64-char hex tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });
});

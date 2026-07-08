import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import * as db from "../db";

let dataDir: string;

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "eduadmin-test-"));
  db.initDb(dataDir);
});

describe("users", () => {
  it("creates, counts, and finds users case-insensitively", () => {
    expect(db.countUsers()).toBe(0);
    const id = db.createUser({ username: "Admin", passwordHash: "h", role: "admin", fullName: "A" });
    expect(id).toBeGreaterThan(0);
    expect(db.countUsers()).toBe(1);
    expect(db.getUserByUsername("admin")?.role).toBe("admin"); // NOCASE match
  });

  it("lists users without exposing password hashes", () => {
    const rows = db.listUsers() as any[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).not.toHaveProperty("passwordHash");
  });
});

describe("auth sessions", () => {
  it("creates, reads, expires, and deletes sessions", () => {
    const uid = db.createUser({ username: "teacher1", passwordHash: "h", role: "teacher" });

    db.createSession("tok-valid", uid, new Date(Date.now() + 60_000).toISOString());
    expect(db.getSession("tok-valid")?.userId).toBe(uid);

    db.createSession("tok-expired", uid, new Date(Date.now() - 1_000).toISOString());
    expect(db.getSession("tok-expired")).toBeNull(); // rejected + swept

    db.deleteSession("tok-valid");
    expect(db.getSession("tok-valid")).toBeNull();
  });
});

describe("notification retry / backoff", () => {
  it("retries below the cap, then fails at the cap", () => {
    const id = db.queueNotification({ type: "sms", message: "hi", recipientPhone: "0244", recipientName: "X" });
    let last: { status: string; attempts: number } | undefined;
    for (let i = 0; i < db.MAX_NOTIFICATION_ATTEMPTS; i++) last = db.recordNotificationAttempt(id);
    expect(last?.status).toBe("failed");
    expect(last?.attempts).toBe(db.MAX_NOTIFICATION_ATTEMPTS);
  });

  it("keeps an item pending and schedules it out of the ready queue", () => {
    const id = db.queueNotification({ type: "sms", message: "later" });
    expect(db.recordNotificationAttempt(id).status).toBe("pending");
    const ready = (db.getPendingNotifications() as any[]).find((n) => n.id === id);
    expect(ready).toBeUndefined(); // backoff window not yet elapsed
  });
});

describe("students & settings", () => {
  it("upserts and reads a student", () => {
    db.upsertStudent({ id: "S1", name: "Ama", classId: "C1", gender: "Female", status: "Enrolled" });
    const all = db.getAllStudents() as any[];
    expect(all.find((s) => s.id === "S1")?.name).toBe("Ama");
  });

  it("stores and reads a setting", () => {
    db.setSetting("school_name", "Demo School");
    expect(db.getSetting("school_name")).toBe("Demo School");
  });

  it("encrypts student contact PII at rest but reads it back in the clear", () => {
    db.upsertStudent({ id: "S2", name: "Kofi", classId: "C1", gender: "Male", status: "Enrolled", phoneNumber: "0201234567" });
    // API read is decrypted
    const s = (db.getAllStudents() as any[]).find((x) => x.id === "S2");
    expect(s.phoneNumber).toBe("0201234567");
    // Raw column on disk is ciphertext, not the phone number
    const raw = new Database(path.join(dataDir, "school_data.db"))
      .prepare("SELECT phoneNumber FROM students WHERE id = 'S2'")
      .get() as { phoneNumber: string };
    expect(raw.phoneNumber.startsWith("enc:v1:")).toBe(true);
    expect(raw.phoneNumber).not.toContain("0201234567");
  });
});

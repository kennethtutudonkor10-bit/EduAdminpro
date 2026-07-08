import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initEncryption, encryptField, decryptField, isEncrypted } from "./crypto-store";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) throw new Error("Database not initialized — call initDb() first.");
  return _db;
}

// ── Initialization ─────────────────────────────────────────────────────────────

export function initDb(userDataPath: string): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  initEncryption(userDataPath);
  const dbPath = path.join(userDataPath, "school_data.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  encryptExistingPii(_db);
}

// Contact/PII columns encrypted at rest. These are never used in WHERE/JOIN/ORDER.
const STUDENT_PII = ["photo", "phoneNumber"] as const;
const STAFF_PII = ["photo", "phoneNumber", "email"] as const;

/** One-time, idempotent migration: encrypt any plaintext PII left by older versions. */
function encryptExistingPii(db: Database.Database): void {
  const migrateTable = (table: string, idCol: string, cols: readonly string[]) => {
    const rows = db.prepare(`SELECT ${idCol}, ${cols.join(", ")} FROM ${table}`).all() as any[];
    const stmt = db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = @${c}`).join(", ")} WHERE ${idCol} = @__id`);
    const run = db.transaction((items: any[]) => {
      for (const r of items) {
        if (!cols.some((c) => r[c] && !isEncrypted(r[c]))) continue; // nothing to do
        const patch: any = { __id: r[idCol] };
        for (const c of cols) patch[c] = encryptField(r[c] ?? null);
        stmt.run(patch);
      }
    });
    run(rows);
  };
  migrateTable("students", "id", STUDENT_PII);
  migrateTable("staff_records", "staffId", STAFF_PII);
}

function decryptStudent(row: any) {
  if (!row) return row;
  return { ...row, photo: decryptField(row.photo), phoneNumber: decryptField(row.phoneNumber) };
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      classId     TEXT NOT NULL,
      gender      TEXT NOT NULL DEFAULT 'Male',
      status      TEXT NOT NULL DEFAULT 'Enrolled',
      photo       TEXT,
      phoneNumber TEXT
    );

    CREATE TABLE IF NOT EXISTS scores (
      studentId   TEXT NOT NULL,
      subjectId   TEXT NOT NULL,
      termId      TEXT NOT NULL,
      test1       REAL,
      test2       REAL,
      hw          REAL,
      exam        REAL,
      remark      TEXT,
      extraScores TEXT,
      PRIMARY KEY (studentId, subjectId, termId)
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id            TEXT PRIMARY KEY,
      studentId     TEXT NOT NULL,
      studentName   TEXT NOT NULL,
      classId       TEXT NOT NULL,
      academicYear  TEXT NOT NULL,
      termId        TEXT NOT NULL,
      billAmount    REAL NOT NULL DEFAULT 0,
      paidAmount    REAL NOT NULL DEFAULT 0,
      paymentMethod TEXT NOT NULL DEFAULT 'Cash',
      balance       REAL NOT NULL DEFAULT 0,
      lastUpdated   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_queue (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT NOT NULL,
      recipientPhone TEXT,
      recipientName  TEXT,
      message        TEXT NOT NULL,
      metadata       TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
      dispatchedAt   TEXT,
      readAt         TEXT
    );

    CREATE TABLE IF NOT EXISTS staff_records (
      staffId          TEXT PRIMARY KEY,
      fullName         TEXT NOT NULL,
      phoneNumber      TEXT NOT NULL DEFAULT '',
      email            TEXT NOT NULL DEFAULT '',
      dateJoined       TEXT NOT NULL DEFAULT '',
      employmentStatus TEXT NOT NULL DEFAULT 'Active',
      staffCategory    TEXT NOT NULL DEFAULT 'Teaching',
      assignedClass    TEXT,
      subjectsTaught   TEXT,
      specificRole     TEXT,
      photo            TEXT,
      department       TEXT,
      isCoordinator    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      date       TEXT NOT NULL,
      termId     TEXT NOT NULL,
      classId    TEXT NOT NULL,
      attendance TEXT NOT NULL,
      PRIMARY KEY (date, classId, termId)
    );

    CREATE TABLE IF NOT EXISTS student_biometrics (
      studentId    TEXT PRIMARY KEY,
      templateHash TEXT NOT NULL,
      registeredAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS biometric_attendance (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId        TEXT NOT NULL,
      studentName      TEXT NOT NULL,
      classId          TEXT NOT NULL,
      termId           TEXT NOT NULL,
      templateHash     TEXT NOT NULL,
      verificationTag  TEXT NOT NULL DEFAULT 'BIOMETRIC',
      verifiedAt       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      username           TEXT NOT NULL UNIQUE COLLATE NOCASE,
      passwordHash       TEXT NOT NULL,
      role               TEXT NOT NULL DEFAULT 'teacher',
      fullName           TEXT NOT NULL DEFAULT '',
      mustChangePassword INTEGER NOT NULL DEFAULT 0,
      createdAt          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token     TEXT PRIMARY KEY,
      userId    INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      expiresAt TEXT NOT NULL
    );
  `);

  // Idempotent column adds for databases created before a column existed.
  ensureColumn(db, "notification_queue", "readAt", "TEXT");
  ensureColumn(db, "notification_queue", "attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "notification_queue", "nextAttemptAt", "TEXT");

  // EduAdmin Pro is free and open-source. All databases start in premium state.
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('tier', 'premium')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('license_status', 'active')").run();
}

/** Adds a column to an existing table only if it isn't already present. */
function ensureColumn(db: Database.Database, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

// ── Students ───────────────────────────────────────────────────────────────────

export function getAllStudents() {
  return (getDb().prepare("SELECT * FROM students ORDER BY classId, name").all() as any[]).map(decryptStudent);
}

export function upsertStudent(student: {
  id: string;
  name: string;
  classId: string;
  gender: string;
  status: string;
  photo?: string | null;
  phoneNumber?: string | null;
}) {
  const row = { photo: null, phoneNumber: null, ...student };
  getDb()
    .prepare(
      `INSERT INTO students (id, name, classId, gender, status, photo, phoneNumber)
       VALUES (@id, @name, @classId, @gender, @status, @photo, @phoneNumber)
       ON CONFLICT(id) DO UPDATE SET
         name        = excluded.name,
         classId     = excluded.classId,
         gender      = excluded.gender,
         status      = excluded.status,
         photo       = excluded.photo,
         phoneNumber = excluded.phoneNumber`
    )
    .run({ ...row, photo: encryptField(row.photo), phoneNumber: encryptField(row.phoneNumber) });

  return decryptStudent(
    getDb()
      .prepare("SELECT * FROM students WHERE id = ?")
      .get(student.id)
  );
}

export function deleteStudent(id: string) {
  return getDb().prepare("DELETE FROM students WHERE id = ?").run(id);
}

// ── Scores ─────────────────────────────────────────────────────────────────────

export function getAllScores() {
  return (getDb().prepare("SELECT * FROM scores").all() as any[]).map(deserializeScore);
}

export function upsertScore(score: {
  studentId: string;
  subjectId: string;
  termId: string;
  test1?: number | null;
  test2?: number | null;
  hw?: number | null;
  exam?: number | null;
  remark?: string | null;
  [key: string]: any;
}) {
  const { studentId, subjectId, termId, test1, test2, hw, exam, remark, ...extras } = score;
  const extraScores = Object.keys(extras).length ? JSON.stringify(extras) : null;

  getDb()
    .prepare(
      `INSERT INTO scores (studentId, subjectId, termId, test1, test2, hw, exam, remark, extraScores)
       VALUES (@studentId, @subjectId, @termId, @test1, @test2, @hw, @exam, @remark, @extraScores)
       ON CONFLICT(studentId, subjectId, termId) DO UPDATE SET
         test1       = excluded.test1,
         test2       = excluded.test2,
         hw          = excluded.hw,
         exam        = excluded.exam,
         remark      = excluded.remark,
         extraScores = excluded.extraScores`
    )
    .run({
      studentId, subjectId, termId,
      test1: test1 ?? null, test2: test2 ?? null, hw: hw ?? null,
      exam: exam ?? null, remark: remark ?? null, extraScores,
    });

  return deserializeScore(
    getDb()
      .prepare("SELECT * FROM scores WHERE studentId = ? AND subjectId = ? AND termId = ?")
      .get(studentId, subjectId, termId)
  );
}

function deserializeScore(row: any) {
  if (!row) return row;
  const { extraScores, ...rest } = row;
  return extraScores ? { ...rest, ...JSON.parse(extraScores) } : rest;
}

// ── Financial Records ──────────────────────────────────────────────────────────

export function getAllFinancialRecords() {
  return getDb().prepare("SELECT * FROM financial_records ORDER BY lastUpdated DESC").all();
}

export function upsertFinancialRecord(record: {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  academicYear: string;
  termId: string;
  billAmount: number;
  paidAmount: number;
  paymentMethod: string;
  balance: number;
  lastUpdated: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO financial_records
         (id, studentId, studentName, classId, academicYear, termId,
          billAmount, paidAmount, paymentMethod, balance, lastUpdated)
       VALUES
         (@id, @studentId, @studentName, @classId, @academicYear, @termId,
          @billAmount, @paidAmount, @paymentMethod, @balance, @lastUpdated)
       ON CONFLICT(id) DO UPDATE SET
         billAmount    = excluded.billAmount,
         paidAmount    = excluded.paidAmount,
         paymentMethod = excluded.paymentMethod,
         balance       = excluded.balance,
         lastUpdated   = excluded.lastUpdated`
    )
    .run(record);

  return getDb()
    .prepare("SELECT * FROM financial_records WHERE id = ?")
    .get(record.id);
}

// ── Seed ───────────────────────────────────────────────────────────────────────

export function isSeeded(): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM students")
    .get() as { count: number };
  return row.count > 0;
}

export function seedDatabase(data: {
  students: any[];
  scores: any[];
  financialRecords: any[];
}): { students: number; scores: number; financialRecords: number } {
  const db = getDb();

  const insertStudent = db.prepare(
    `INSERT OR IGNORE INTO students (id, name, classId, gender, status, photo, phoneNumber)
     VALUES (@id, @name, @classId, @gender, @status, @photo, @phoneNumber)`
  );
  const insertScore = db.prepare(
    `INSERT OR IGNORE INTO scores (studentId, subjectId, termId, test1, test2, hw, exam, remark)
     VALUES (@studentId, @subjectId, @termId, @test1, @test2, @hw, @exam, @remark)`
  );
  const insertFinancial = db.prepare(
    `INSERT OR IGNORE INTO financial_records
       (id, studentId, studentName, classId, academicYear, termId,
        billAmount, paidAmount, paymentMethod, balance, lastUpdated)
     VALUES
       (@id, @studentId, @studentName, @classId, @academicYear, @termId,
        @billAmount, @paidAmount, @paymentMethod, @balance, @lastUpdated)`
  );

  const run = db.transaction(() => {
    data.students.forEach((s) => {
      const row = { photo: null, phoneNumber: null, ...s };
      insertStudent.run({ ...row, photo: encryptField(row.photo), phoneNumber: encryptField(row.phoneNumber) });
    });
    data.scores.forEach((s) =>
      insertScore.run({
        test1: null, test2: null, hw: null, exam: null, remark: null, ...s,
      })
    );
    data.financialRecords.forEach((f) => insertFinancial.run(f));
  });

  run();

  return {
    students: data.students.length,
    scores: data.scores.length,
    financialRecords: data.financialRecords.length,
  };
}

// ── Scores batch ───────────────────────��───────────────────────��───────────────

export function upsertScoresBatch(scoresList: any[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO scores (studentId, subjectId, termId, test1, test2, hw, exam, remark, extraScores)
     VALUES (@studentId, @subjectId, @termId, @test1, @test2, @hw, @exam, @remark, @extraScores)
     ON CONFLICT(studentId, subjectId, termId) DO UPDATE SET
       test1       = excluded.test1,
       test2       = excluded.test2,
       hw          = excluded.hw,
       exam        = excluded.exam,
       remark      = excluded.remark,
       extraScores = excluded.extraScores`
  );
  const run = db.transaction(() => {
    scoresList.forEach((s) => {
      const { studentId, subjectId, termId, test1, test2, hw, exam, remark, ...extras } = s;
      const extraScores = Object.keys(extras).length ? JSON.stringify(extras) : null;
      stmt.run({
        studentId, subjectId, termId,
        test1: test1 ?? null, test2: test2 ?? null, hw: hw ?? null,
        exam: exam ?? null, remark: remark ?? null, extraScores,
      });
    });
  });
  run();
  return scoresList.length;
}

// ── Settings ───────────────────���──────────────────────────────────��────────────

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {} as Record<string, string>);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}

// ── Notification Queue ─────────────────────────────────────────────────────────

export function queueNotification(entry: {
  type: string;
  recipientPhone?: string | null;
  recipientName?: string | null;
  message: string;
  metadata?: object | null;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO notification_queue (type, recipientPhone, recipientName, message, metadata)
       VALUES (@type, @recipientPhone, @recipientName, @message, @metadata)`
    )
    .run({
      type: entry.type,
      recipientPhone: entry.recipientPhone ?? null,
      recipientName: entry.recipientName ?? null,
      message: entry.message,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    }) as Database.RunResult;
  return result.lastInsertRowid as number;
}

function deserializeNotification(row: any) {
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

/**
 * SMS outbound queue — messages awaiting delivery whose backoff window has
 * elapsed (nextAttemptAt in the past, or never scheduled). Drives /dispatch.
 */
export function getPendingNotifications() {
  return (getDb()
    .prepare(
      `SELECT * FROM notification_queue
       WHERE status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= datetime('now'))
       ORDER BY createdAt ASC`
    )
    .all() as any[])
    .map(deserializeNotification);
}

/** Max delivery attempts before a notification is marked permanently failed. */
export const MAX_NOTIFICATION_ATTEMPTS = 5;

/**
 * Records a failed delivery attempt. Below the attempt cap it stays 'pending'
 * with an exponential-backoff nextAttemptAt; at the cap it becomes 'failed'.
 * Returns the resulting state so callers can report retry vs. give-up.
 */
export function recordNotificationAttempt(id: number): { status: "pending" | "failed"; attempts: number } {
  const db = getDb();
  const row = db.prepare("SELECT attempts FROM notification_queue WHERE id = ?").get(id) as { attempts: number } | undefined;
  const attempts = (row?.attempts ?? 0) + 1;
  if (attempts >= MAX_NOTIFICATION_ATTEMPTS) {
    db.prepare("UPDATE notification_queue SET status = 'failed', attempts = ? WHERE id = ?").run(attempts, id);
    return { status: "failed", attempts };
  }
  // Exponential backoff in minutes: 2, 4, 8, 16 … capped at 30.
  const delayMin = Math.min(2 ** attempts, 30);
  db.prepare(
    `UPDATE notification_queue
     SET status = 'pending', attempts = ?, nextAttemptAt = datetime('now', ?)
     WHERE id = ?`
  ).run(attempts, `+${delayMin} minutes`, id);
  return { status: "pending", attempts };
}

/**
 * Inbox history for the mobile app — every message, regardless of SMS delivery
 * state, newest first. Read state lives in readAt, kept separate from the SMS
 * `status` column so reading a message in the app never affects the SMS queue.
 */
export function getAllNotifications() {
  return (getDb().prepare("SELECT * FROM notification_queue ORDER BY createdAt DESC").all() as any[])
    .map(deserializeNotification);
}

export function markNotificationDispatched(id: number): void {
  getDb()
    .prepare("UPDATE notification_queue SET status = 'dispatched', dispatchedAt = datetime('now') WHERE id = ?")
    .run(id);
}

export function markNotificationFailed(id: number): void {
  getDb()
    .prepare("UPDATE notification_queue SET status = 'failed' WHERE id = ?")
    .run(id);
}

/** Marks an inbox message read without touching its SMS delivery status. */
export function markNotificationRead(id: number): void {
  getDb()
    .prepare("UPDATE notification_queue SET readAt = datetime('now') WHERE id = ?")
    .run(id);
}

// ── Staff Records ──────────────────────────────────────────────────────────────

export function getAllStaff() {
  return (getDb().prepare("SELECT * FROM staff_records ORDER BY fullName ASC").all() as any[]).map(deserializeStaff);
}

export function upsertStaff(s: any): void {
  getDb()
    .prepare(
      `INSERT INTO staff_records
         (staffId, fullName, phoneNumber, email, dateJoined, employmentStatus, staffCategory,
          assignedClass, subjectsTaught, specificRole, photo, department, isCoordinator)
       VALUES
         (@staffId, @fullName, @phoneNumber, @email, @dateJoined, @employmentStatus, @staffCategory,
          @assignedClass, @subjectsTaught, @specificRole, @photo, @department, @isCoordinator)
       ON CONFLICT(staffId) DO UPDATE SET
         fullName = excluded.fullName, phoneNumber = excluded.phoneNumber, email = excluded.email,
         dateJoined = excluded.dateJoined, employmentStatus = excluded.employmentStatus,
         staffCategory = excluded.staffCategory, assignedClass = excluded.assignedClass,
         subjectsTaught = excluded.subjectsTaught, specificRole = excluded.specificRole,
         photo = excluded.photo, department = excluded.department, isCoordinator = excluded.isCoordinator`
    )
    .run({
      staffId: s.staffId, fullName: s.fullName,
      phoneNumber: encryptField(s.phoneNumber ?? '') ?? '', email: encryptField(s.email ?? '') ?? '',
      dateJoined: s.dateJoined ?? '', employmentStatus: s.employmentStatus ?? 'Active',
      staffCategory: s.staffCategory ?? 'Teaching',
      assignedClass: s.assignedClass ?? null,
      subjectsTaught: s.subjectsTaught ? JSON.stringify(s.subjectsTaught) : null,
      specificRole: s.specificRole ?? null, photo: encryptField(s.photo ?? null),
      department: s.department ?? null, isCoordinator: s.isCoordinator ? 1 : 0,
    });
}

export function deleteStaff(staffId: string): void {
  getDb().prepare("DELETE FROM staff_records WHERE staffId = ?").run(staffId);
}

function deserializeStaff(row: any) {
  if (!row) return row;
  return {
    ...row,
    phoneNumber: decryptField(row.phoneNumber) ?? '',
    email: decryptField(row.email) ?? '',
    photo: decryptField(row.photo),
    isCoordinator: !!row.isCoordinator,
    subjectsTaught: row.subjectsTaught ? JSON.parse(row.subjectsTaught) : undefined,
  };
}

// ── Attendance Records ─────────────────────────────────────────────────────────

export function getAllAttendanceRecords() {
  return (getDb().prepare("SELECT * FROM attendance_records ORDER BY date DESC").all() as any[]).map(row => ({
    ...row,
    attendance: JSON.parse(row.attendance),
  }));
}

export function upsertAttendanceRecord(record: { date: string; termId: string; classId: string; attendance: Record<string, string> }): void {
  getDb()
    .prepare(
      `INSERT INTO attendance_records (date, termId, classId, attendance)
       VALUES (@date, @termId, @classId, @attendance)
       ON CONFLICT(date, classId, termId) DO UPDATE SET attendance = excluded.attendance`
    )
    .run({ ...record, attendance: JSON.stringify(record.attendance) });
}

// ── Biometric Registry ─────────────────────────────────────────────────────────

export function upsertStudentBiometric(studentId: string, templateHash: string): void {
  getDb()
    .prepare(
      `INSERT INTO student_biometrics (studentId, templateHash)
       VALUES (?, ?)
       ON CONFLICT(studentId) DO UPDATE SET templateHash = excluded.templateHash,
                                            registeredAt = datetime('now')`
    )
    .run(studentId, templateHash);
}

export function getStudentByTemplateHash(templateHash: string): { studentId: string; registeredAt: string } | null {
  return (getDb()
    .prepare("SELECT studentId, registeredAt FROM student_biometrics WHERE templateHash = ?")
    .get(templateHash) as { studentId: string; registeredAt: string }) ?? null;
}

export function getAllBiometricEnrollments(): any[] {
  return getDb().prepare(
    `SELECT sb.studentId, sb.templateHash, sb.registeredAt, s.name, s.classId
     FROM student_biometrics sb
     LEFT JOIN students s ON s.id = sb.studentId
     ORDER BY sb.registeredAt DESC`
  ).all() as any[];
}

// ── Biometric Attendance ───────────────────────────────────────────────────────

export function saveBiometricAttendance(record: {
  studentId: string;
  studentName: string;
  classId: string;
  termId: string;
  templateHash: string;
  verifiedAt?: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO biometric_attendance
         (studentId, studentName, classId, termId, templateHash, verifiedAt)
       VALUES (@studentId, @studentName, @classId, @termId, @templateHash, @verifiedAt)`
    )
    .run({
      ...record,
      verifiedAt: record.verifiedAt ?? new Date().toISOString(),
    }) as Database.RunResult;
  return result.lastInsertRowid as number;
}

export function getBiometricAttendanceByTerm(termId: string, classId?: string): any[] {
  const query = classId
    ? "SELECT * FROM biometric_attendance WHERE termId = ? AND classId = ? ORDER BY verifiedAt DESC"
    : "SELECT * FROM biometric_attendance WHERE termId = ? ORDER BY verifiedAt DESC";
  return getDb().prepare(query).all(classId ? [termId, classId] : [termId]) as any[];
}

/** Counts unique days a student was scanned in a given term — used by report card PDF. */
export function countBiometricDaysPresent(studentId: string, termId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT date(verifiedAt)) AS days
       FROM biometric_attendance
       WHERE studentId = ? AND termId = ?`
    )
    .get(studentId, termId) as { days: number };
  return row?.days ?? 0;
}

// ── Users & auth sessions ────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  fullName: string;
  mustChangePassword: number;
  createdAt: string;
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
}

export function createUser(u: {
  username: string;
  passwordHash: string;
  role: string;
  fullName?: string;
  mustChangePassword?: boolean;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, passwordHash, role, fullName, mustChangePassword)
       VALUES (@username, @passwordHash, @role, @fullName, @mustChangePassword)`
    )
    .run({
      username: u.username,
      passwordHash: u.passwordHash,
      role: u.role,
      fullName: u.fullName ?? "",
      mustChangePassword: u.mustChangePassword ? 1 : 0,
    }) as Database.RunResult;
  return result.lastInsertRowid as number;
}

export function getUserByUsername(username: string): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as UserRow) ?? null;
}

export function getUserById(id: number): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow) ?? null;
}

/** Users without password hashes — safe to serialize to clients. */
export function listUsers() {
  return getDb()
    .prepare("SELECT id, username, role, fullName, mustChangePassword, createdAt FROM users ORDER BY username")
    .all();
}

export function updateUserPassword(id: number, passwordHash: string): void {
  getDb()
    .prepare("UPDATE users SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?")
    .run(passwordHash, id);
}

export function deleteUser(id: number): { changes: number } {
  return getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createSession(token: string, userId: number, expiresAt: string): void {
  getDb()
    .prepare("INSERT INTO auth_sessions (token, userId, expiresAt) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt);
}

/** Returns the session joined to its user, or null if missing/expired. */
export function getSession(token: string): { userId: number; role: string; username: string; expiresAt: string } | null {
  const row = getDb()
    .prepare(
      `SELECT s.userId, s.expiresAt, u.role, u.username
       FROM auth_sessions s JOIN users u ON u.id = s.userId
       WHERE s.token = ?`
    )
    .get(token) as { userId: number; role: string; username: string; expiresAt: string } | undefined;
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return row;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

/** Invalidates every session for a user — used after a password change. */
export function deleteSessionsForUser(userId: number): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE userId = ?").run(userId);
}

export function purgeExpiredSessions(): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE expiresAt < ?").run(new Date().toISOString());
}

// ── Full data export ───────────────────────────────────────────────────────────

export function exportAllData() {
  return {
    exportedAt: new Date().toISOString(),
    students: getAllStudents(),
    scores: getAllScores(),
    financialRecords: getAllFinancialRecords(),
    staffRecords: getAllStaff(),
    settings: getAllSettings(),
  };
}

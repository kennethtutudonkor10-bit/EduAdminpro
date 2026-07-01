/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reliable write-through to the local EduAdmin server (SQLite source of truth).
 *
 * localStorage remains the immediate in-memory cache, but writes to the database
 * used to be fire-and-forget: `fetch(...).catch(() => {})`. A single transient
 * failure (server busy, Wi-Fi blip, app still booting) silently dropped the write,
 * and because the DB is authoritative on the next load, that edit was lost.
 *
 * This module guarantees writes eventually reach the DB: each POST/DELETE is tried
 * immediately, and on failure it is appended to a durable outbox in localStorage
 * and retried — on an interval, when the browser comes back online, and on demand.
 * Order is preserved (a create followed by a delete replays in sequence).
 */

type Op = {
  id: string;
  method: "POST" | "DELETE";
  url: string;
  body?: unknown;
};

const OUTBOX_KEY = "edu_admin_sync_outbox";

function loadOutbox(): Op[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    return [];
  }
}

function saveOutbox(ops: Op[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    // Storage full or unavailable — nothing more we can do here.
  }
}

// ── Status listeners (pending write count) ──────────────────────────────────────

let listeners: ((pending: number) => void)[] = [];

/** Subscribe to the number of unsynced writes. Fires immediately with the current count. */
export function onSyncStatus(cb: (pending: number) => void): () => void {
  listeners.push(cb);
  cb(loadOutbox().length);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function emit(): void {
  const pending = loadOutbox().length;
  listeners.forEach((l) => {
    try {
      l(pending);
    } catch {
      /* listener errors must not break the queue */
    }
  });
}

// ── Core ────────────────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function attempt(op: Op): Promise<boolean> {
  try {
    const res = await fetch(op.url, {
      method: op.method,
      headers: op.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function enqueue(op: Op): void {
  const ops = loadOutbox();
  ops.push(op);
  saveOutbox(ops);
  emit();
}

let flushing = false;

/** Replays queued writes in order, stopping at the first failure to retry later. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (true) {
      const ops = loadOutbox();
      if (ops.length === 0) break;
      const ok = await attempt(ops[0]);
      if (!ok) break; // preserve order; the interval/online handler will retry
      const remaining = loadOutbox();
      remaining.shift();
      saveOutbox(remaining);
      emit();
    }
  } finally {
    flushing = false;
  }
}

async function send(op: Op): Promise<void> {
  // If nothing is queued, try a direct send for the common (online) fast path.
  // If anything is already queued, append to preserve ordering.
  if (loadOutbox().length === 0 && (await attempt(op))) return;
  enqueue(op);
  void flushOutbox();
}

/** Drop-in replacement for the old fire-and-forget POST helper. */
export function dbPost(url: string, body: object): void {
  void send({ id: newId(), method: "POST", url, body });
}

/** Drop-in replacement for the old fire-and-forget DELETE helper. */
export function dbDelete(url: string): void {
  void send({ id: newId(), method: "DELETE", url });
}

/**
 * Starts background syncing: an immediate flush, a periodic retry, and a flush
 * whenever the browser regains connectivity. Returns a stop function.
 */
export function startSync(intervalMs = 15000): () => void {
  void flushOutbox();
  const onOnline = () => void flushOutbox();
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(() => void flushOutbox(), intervalMs);
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}

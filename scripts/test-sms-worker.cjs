"use strict";
const http = require("http");

const API_PORT = parseInt(process.env.PORT || "3000", 10);
const WEBHOOK_PORT = 59900; // local mock gateway

let passed = 0;
let failed = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: API_PORT, path }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on("error", reject);
  });
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1", port: API_PORT, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch (_) { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function assert(label, condition, info) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${info ? " — " + info : ""}`);
    failed++;
  }
}

// ── Mock SMS gateway ──────────────────────────────────────────────────────────
// Accepts whatever the server POSTs, logs it, returns 200 OK.

function startMockGateway() {
  return new Promise((resolve) => {
    const received = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try { received.push(JSON.parse(body)); } catch (_) { received.push(body); }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(WEBHOOK_PORT, "127.0.0.1", () => resolve({ server, received }));
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nEduAdmin Pro — SMS Worker & Queue Health Tests`);
  console.log(`API server : http://127.0.0.1:${API_PORT}`);
  console.log(`Mock gateway: http://127.0.0.1:${WEBHOOK_PORT}\n`);

  // ── Setup: start mock gateway, register its URL ───────────────────────────
  const { server: mockServer, received } = await startMockGateway();
  const webhookUrl = `http://127.0.0.1:${WEBHOOK_PORT}/sms`;
  await apiPost("/api/db/settings", { key: "webhook_url", value: webhookUrl });

  // ── Setup: seed a known notification so the queue is non-empty ────────────
  const seed = await apiPost("/api/notifications/queue", {
    type: "attendance_checkin",
    recipientName: "Abena Mensah",
    recipientPhone: "+233201234567",
    message: "EduAdmin Pro: Abena Mensah checked in at 08:15 AM via Terminal Gate Wi-Fi.",
  });

  // ── Test 1: Pending queue is non-empty before dispatch ────────────────────
  console.log("Test 1: /api/notifications/pending has rows before dispatch");
  const before = await apiGet("/api/notifications/pending");
  assert("response is an array",              Array.isArray(before.body),     JSON.stringify(before.body));
  assert("at least one pending notification", before.body.length >= 1,        `got ${before.body.length}`);
  const seeded = before.body.find(n => n.id === seed.body.id);
  assert("seeded row is present with status 'pending'", seeded?.status === "pending", `got ${seeded?.status}`);
  console.log(`  INFO  ${before.body.length} pending notification(s) found`);

  // ── Test 2: Dispatch — server POSTs each notification to the mock gateway ─
  console.log("\nTest 2: POST /api/notifications/dispatch drives mock SMS gateway");
  const dispatch = await apiPost("/api/notifications/dispatch", {});
  assert("dispatch returns HTTP 200",              dispatch.status === 200,              `got ${dispatch.status}`);
  assert("dispatched count >= 1",                  dispatch.body?.dispatched >= 1,        `got ${dispatch.body?.dispatched}`);
  assert("failed count is 0",                      dispatch.body?.failed === 0,           `got ${dispatch.body?.failed}`);
  assert("mock gateway received the notification", received.length >= 1,                  `received ${received.length}`);
  if (received.length > 0) {
    console.log(`  INFO  Gateway payload: ${JSON.stringify(received[0])}`);
  }

  // ── Test 3: Pending queue is empty after successful dispatch ──────────────
  console.log("\nTest 3: /api/notifications/pending is empty after dispatch");
  const after = await apiGet("/api/notifications/pending");
  assert("response is an array",                  Array.isArray(after.body), JSON.stringify(after.body));
  assert("pending queue is empty (zero orphans)", after.body.length === 0,  `got ${after.body.length} item(s) remaining`);

  // ── Test 4: Rapid load — 10 notifications queued and cleared in one pass ──
  console.log("\nTest 4: Rapid load — 10 check-ins queued and dispatched atomically");
  const names = [
    "Kwame Asante", "Ama Boateng", "Kofi Osei", "Adjoa Frimpong", "Yaw Darko",
    "Akua Mensah", "Kojo Antwi", "Efua Asiedu", "Nana Adjei", "Abby Owusu",
  ];
  await Promise.all(
    names.map((name, i) =>
      apiPost("/api/notifications/queue", {
        type: "attendance_checkin",
        recipientName: name,
        recipientPhone: `+23320${i}000000`,
        message: `EduAdmin Pro: ${name} verified at 08:${String(20 + i).padStart(2, "0")} AM.`,
      })
    )
  );

  const bulk = await apiPost("/api/notifications/dispatch", {});
  assert("all 10 dispatched without failures", bulk.body?.dispatched === 10 && bulk.body?.failed === 0,
         `dispatched=${bulk.body?.dispatched} failed=${bulk.body?.failed}`);

  const afterBulk = await apiGet("/api/notifications/pending");
  assert("queue fully drained after bulk dispatch", afterBulk.body.length === 0, `got ${afterBulk.body.length} orphan(s)`);
  console.log(`  INFO  Mock gateway total calls received: ${received.length}`);

  // ── Teardown ──────────────────────────────────────────────────────────────
  mockServer.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e.stack); process.exit(1); });

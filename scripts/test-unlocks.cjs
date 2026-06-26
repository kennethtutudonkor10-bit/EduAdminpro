"use strict";
const http = require("http");

const PORT = parseInt(process.env.PORT || "3000", 10);

let passed = 0;
let failed = 0;

function get(endpoint) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path: endpoint }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on("error", reject);
  });
}

function post(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: endpoint, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
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

async function run() {
  console.log(`\nEduAdmin Pro — Activation Code Integration Tests`);
  console.log(`Server: http://127.0.0.1:${PORT}`);
  console.log(`Database: via /api/db/settings\n`);

  // ── Test 1: Valid activation code ──────────────────────────────────────────
  console.log("Test 1: POST GH-SCHOOLS-2026 (valid code)");
  let res;
  try {
    res = await post("/api/activate", { code: "GH-SCHOOLS-2026" });
  } catch (e) {
    console.log(`  ERROR  Cannot reach server — is it running on port ${PORT}? (${e.message})\n`);
    process.exit(1);
  }
  assert("HTTP status is 200",        res.status === 200,        `got ${res.status}`);
  assert("success is true",           res.body?.success === true, JSON.stringify(res.body));
  assert("tier is 'premium'",         res.body?.tier === "premium");
  assert("message confirms activation", typeof res.body?.message === "string" && res.body.message.length > 0);

  // ── Test 2: Database state check via settings API ─────────────────────────
  console.log("\nTest 2: DB state confirmed via GET /api/db/settings");
  const [s1, s2, s3] = await Promise.all([
    get("/api/db/settings/license_status"),
    get("/api/db/settings/tier"),
    get("/api/db/settings/activated_code"),
  ]);
  assert("settings.license_status = 'active'",          s1.body?.value === "active",          `got: ${s1.body?.value}`);
  assert("settings.tier = 'premium'",                   s2.body?.value === "premium",          `got: ${s2.body?.value}`);
  assert("settings.activated_code = 'GH-SCHOOLS-2026'", s3.body?.value === "GH-SCHOOLS-2026",  `got: ${s3.body?.value}`);

  // ── Test 3: Invalid code rejection ────────────────────────────────────────
  console.log("\nTest 3: POST INVALID-TEST-123 (bad code)");
  const bad = await post("/api/activate", { code: "INVALID-TEST-123" });
  assert("HTTP status is 400",  bad.status === 400,         `got ${bad.status}`);
  assert("success is false",    bad.body?.success === false, JSON.stringify(bad.body));
  assert("error message present", typeof bad.body?.message === "string" && bad.body.message.length > 0);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e.stack); process.exit(1); });

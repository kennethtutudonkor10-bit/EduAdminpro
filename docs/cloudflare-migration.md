# Deploying EduAdmin Pro to Cloudflare — Step‑by‑Step Guide

This guide migrates the full web app to Cloudflare:

- **Frontend** (React/Vite SPA) → **Cloudflare Pages**
- **API** (`server.ts`, Express) → **Cloudflare Worker** (via [Hono](https://hono.dev))
- **Database** (`db.ts`, `better-sqlite3`) → **Cloudflare D1**
- **Blobs** (photos, signatures) → **Cloudflare R2** *(optional)*

> The frontend already calls the backend over **relative `/api/...` paths**, so
> once a Worker serves `/api/*` at the same origin, the React app needs almost no
> changes. The bulk of the work is the backend.

---

## Before you start — 3 decisions that shape everything

1. **Authentication.** `server.ts` ships with auth intentionally omitted
   (LAN‑only). A public Cloudflare URL exposes all student data. **You must add
   auth** (Cloudflare Access or JWT) — covered in Step 8.
2. **Multi‑tenancy.** One SQLite file = one school today. One shared D1 = all
   schools. This guide assumes **one Worker + one D1 per school** (simplest,
   preserves the single‑tenant model). For a shared DB, add a `schoolId` column
   to every table and filter every query.
3. **Data residency.** D1 lives on Cloudflare's network, not the school's PC —
   this changes the "data stays local" promise in the EULA. Keep the Electron +
   local‑SQLite build for schools that need local‑only storage; treat Cloudflare
   as an opt‑in hosted edition. Use D1 **location hints** (Step 3) for the
   closest region.

---

## Prerequisites

```bash
# A Cloudflare account (free tier is enough to start)
npm install -g wrangler        # or use: npx wrangler@latest
wrangler login                 # opens a browser to authorize
wrangler whoami                # confirm you're logged in
```

You'll also need your **Google Gemini API key** (from Google AI Studio) and, if
you use SMS, your **Hubtel** client id/secret.

> **Note on this remote container:** the actual `wrangler login` / `deploy` steps
> must be run where your Cloudflare credentials live (your machine or CI). The
> code changes below can be prepared anywhere.

---

## Step 1 — Create the Cloudflare project skeleton

Create a `cloudflare/` workspace so the migration doesn't disturb the existing
Electron build.

```bash
mkdir -p cloudflare/worker/src
cd cloudflare/worker
npm init -y
npm install hono
npm install -D wrangler @cloudflare/workers-types typescript
```

Create `cloudflare/worker/wrangler.toml`:

```toml
name = "eduadmin-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# D1 binding (id filled in at Step 3)
[[d1_databases]]
binding = "DB"
database_name = "eduadmin"
database_id = "REPLACE_AFTER_STEP_3"

# R2 binding (optional, Step 7)
# [[r2_buckets]]
# binding = "BLOBS"
# bucket_name = "eduadmin-blobs"

# Serve the built SPA from the same Worker (so /api/* and / share an origin)
[assets]
directory = "../../dist"
binding = "ASSETS"
```

---

## Step 2 — Turn the schema into a D1 migration

Copy the `CREATE TABLE` statements from `migrate()` in `db.ts` (lines ~24–119)
into a migration file. They are standard SQLite and port verbatim.

```bash
cd cloudflare/worker
wrangler d1 migrations create eduadmin initial_schema
# creates migrations/0001_initial_schema.sql
```

Paste the schema into `migrations/0001_initial_schema.sql`, then append the two
seed rows from `db.ts` (lines ~122–123):

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('tier', 'premium');
INSERT OR IGNORE INTO settings (key, value) VALUES ('license_status', 'active');
```

> Drop `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` — D1 doesn't need
> them. `AUTOINCREMENT` and `datetime('now')` defaults work as‑is.

---

## Step 3 — Create the D1 database

```bash
wrangler d1 create eduadmin --location weur   # pick the closest region hint
```

Copy the printed `database_id` into `wrangler.toml` (Step 1). Then apply the
schema:

```bash
wrangler d1 migrations apply eduadmin --local    # test locally first
wrangler d1 migrations apply eduadmin --remote    # then the real DB
```

---

## Step 4 — Rewrite the data layer for D1

Create `cloudflare/worker/src/db.ts`. Port each function from the project‑root
`db.ts` with **three mechanical changes**:

1. **Sync → async** — every function returns a `Promise` and takes the D1 binding.
2. **Named params `@id` → positional `?`** — D1's `.bind()` is positional only.
3. **`db.transaction()` → `env.DB.batch([...])`** — atomic multi‑statement.

**Example — simple read (`getAllStudents`):**

```ts
// before (better-sqlite3, sync)
export function getAllStudents() {
  return getDb().prepare("SELECT * FROM students ORDER BY classId, name").all();
}

// after (D1, async)
export async function getAllStudents(db: D1Database) {
  const { results } = await db
    .prepare("SELECT * FROM students ORDER BY classId, name")
    .all();
  return results;
}
```

**Example — upsert with positional binding (`setSetting`):**

```ts
export async function setSetting(db: D1Database, key: string, value: string) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key, value)
    .run();
}
```

**Example — transaction → batch (`seedDatabase` / `upsertScoresBatch`):**

```ts
export async function upsertScoresBatch(db: D1Database, scoresList: any[]) {
  const stmt = db.prepare(
    `INSERT INTO scores (studentId, subjectId, termId, test1, test2, hw, exam, remark, extraScores)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(studentId, subjectId, termId) DO UPDATE SET
       test1=excluded.test1, test2=excluded.test2, hw=excluded.hw,
       exam=excluded.exam, remark=excluded.remark, extraScores=excluded.extraScores`
  );
  const batch = scoresList.map((s) => {
    const { studentId, subjectId, termId, test1, test2, hw, exam, remark, ...extras } = s;
    const extraScores = Object.keys(extras).length ? JSON.stringify(extras) : null;
    return stmt.bind(studentId, subjectId, termId,
      test1 ?? null, test2 ?? null, hw ?? null, exam ?? null, remark ?? null, extraScores);
  });
  await db.batch(batch);          // atomic
  return scoresList.length;
}
```

Repeat for all 29 exported functions in `db.ts`.

---

## Step 5 — Port the API to a Hono Worker

Create `cloudflare/worker/src/index.ts`. Hono mirrors Express, so the ~40 routes
port with light edits — mainly `await`ing the new async db calls and reading the
D1 binding from `c.env.DB`.

```ts
import { Hono } from "hono";
import * as db from "./db";

type Env = { DB: D1Database; GEMINI_API_KEY: string; ASSETS: Fetcher };
const app = new Hono<{ Bindings: Env }>();

// Example: GET /api/db/students
app.get("/api/db/students", async (c) => {
  return c.json(await db.getAllStudents(c.env.DB));
});

// Example: POST /api/db/students
app.post("/api/db/students", async (c) => {
  const b = await c.req.json();
  if (!b.id || !b.name || !b.classId)
    return c.json({ error: "id, name, and classId are required." }, 400);
  return c.json(await db.upsertStudent(c.env.DB, {
    ...b, gender: b.gender || "Male", status: b.status || "Enrolled",
  }));
});

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Everything that isn't /api/* → serve the SPA from the assets binding
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

Port every route from `server.ts` this way. Key ones to not forget:
`/api/save-student`, `/api/db/scores(/batch)`, `/api/db/financial`,
`/api/db/settings(/:key)`, `/api/db/seed`, the notification queue/dispatch
routes, staff, attendance, the print‑hub routes, the mobile `/api/v1/*` routes,
and `/api/export`.

### The AI route (`/api/ai-execute`)

The `@google/genai` SDK may not run cleanly on Workers. The robust option is to
**call Gemini with raw `fetch`** — your existing `worker/src/index.ts` already
does exactly this; reuse that pattern. Keep the local rule‑based fallback (the
"no API key" branch in `server.ts`) so the app still works without a key.

---

## Step 6 — Set secrets

```bash
cd cloudflare/worker
wrangler secret put GEMINI_API_KEY        # paste your Google AI Studio key
# optional SMS:
wrangler secret put HUBTEL_CLIENT_ID
wrangler secret put HUBTEL_CLIENT_SECRET
wrangler secret put HUBTEL_SENDER_ID
```

Runtime settings that live in the DB today (school name, logo, channel toggles)
stay in the D1 `settings` table — no change.

---

## Step 7 — (Optional) Move large blobs to R2

Photos and the admin signature are stored as base64 in D1/settings today, and
`server.ts` allows 50 MB JSON. D1 has per‑row/query size limits, so for anything
bigger than small avatars:

```bash
wrangler r2 bucket create eduadmin-blobs
```

Uncomment the `[[r2_buckets]]` binding in `wrangler.toml`, store the image in R2
under a key, and keep only that key in D1. Serve via a `/api/v1/user/avatar/...`
route that reads from `c.env.BLOBS`.

---

## Step 8 — Add authentication (do NOT skip)

Pick one before exposing the URL:

- **Cloudflare Access (fastest):** put the Pages/Worker behind Access in the
  Cloudflare Zero Trust dashboard. Restrict to your staff emails / a Google
  Workspace domain. No app code needed.
- **App‑level JWT/API key:** add a Hono middleware that checks an
  `Authorization` header on every `/api/*` route and rejects anonymous requests.

```ts
app.use("/api/*", async (c, next) => {
  const key = c.req.header("Authorization");
  if (key !== `Bearer ${c.env.API_KEY}`) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
```

---

## Step 9 — Build the frontend and run locally

From the project root:

```bash
npm run build            # vite build → dist/  (server bundle step is unused here)
cd cloudflare/worker
wrangler dev             # serves API + SPA at http://localhost:8787 on local D1
```

Smoke‑test: open the URL, accept the EULA, confirm the dashboard loads and
students/scores render (they'll be empty until Step 10).

---

## Step 10 — Migrate existing data

The app already exposes a full export: **`GET /api/export`** dumps every table
to JSON. Use it as the migration source.

```bash
# From a running local/Electron instance:
curl http://localhost:3000/api/export > backup.json
```

Write a small importer that POSTs the export through the new endpoints
(`/api/db/seed` for students/scores/financials, then settings, staff,
attendance), or convert `backup.json` into `INSERT` statements and run:

```bash
wrangler d1 execute eduadmin --remote --file=./import.sql
```

---

## Step 11 — Deploy

```bash
cd cloudflare/worker
wrangler deploy
```

This publishes the Worker (API + SPA assets) to
`https://eduadmin-api.<your-subdomain>.workers.dev`.

Add a custom domain in the Cloudflare dashboard (Workers → your worker →
Triggers → Custom Domains), e.g. `app.yourschool.edu.gh`.

---

## Step 12 — Verify in production

- `GET /api/health` returns `{ ok: true }`.
- EULA → dashboard loads; create a student and confirm it persists (reload).
- Grading grid saves scores; fees and attendance read back.
- AI Agent Console returns a response (or the rule‑based fallback with no key).
- Auth blocks an un‑authenticated `curl` to `/api/db/students`.

---

## Rollback / dual‑running

The **Electron + local‑SQLite** build is untouched by any of the above — it
remains the fallback and the privacy‑preserving option. You can run both
editions in parallel and let each school choose.

---

## Effort summary

| Task | Size |
|------|------|
| D1 schema migration (Step 2–3) | Small |
| `db.ts` rewrite — async + positional + batch (Step 4) | **Large** (29 fns) |
| `server.ts` → Hono Worker (Step 5) | **Large** (~40 routes) |
| Auth (Step 8) | Medium |
| Frontend/Pages wiring (Step 1, 9) | Small |
| Data migration (Step 10) | Small–Medium |

---

## Faster alternative (if "Cloudflare specifically" isn't the requirement)

If the goal is simply to host it online, deploying the **existing Express +
better‑sqlite3** server to a Node host with a persistent volume (Fly.io,
Railway, Render) is near‑zero code change and keeps the single‑file SQLite model.
Choose Cloudflare for edge/scale; choose a Node host for speed to launch.

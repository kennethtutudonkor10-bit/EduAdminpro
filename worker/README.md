# EduAdmin AI Worker (Cloudflare)

A tiny Cloudflare Worker that generates a professional report-card remark for a
student from their grades, attendance, and behaviour, using Google Gemini
(`gemini-2.5-flash`). This is the **only** part of EduAdmin Pro that runs on
Cloudflare — the desktop app (Express + SQLite) is offline-first and does not.

## API

`POST /` with a JSON body:

```json
{
  "studentName": "Ama Mensah",
  "classLevel": "JHS 1",
  "grades": { "Mathematics": 82, "English": 74 },
  "attendance": 95,
  "behavior": "attentive and cooperative"
}
```

Returns `{ "remark": "..." }`. `studentName`, `classLevel`, and `grades` are
required (`422` otherwise). CORS is open (`*`) so a browser client can call it.

## Deploy

Prerequisites: a Cloudflare account and Node.js.

```bash
cd worker
npm install

# One-time: authenticate wrangler with your Cloudflare account
npx wrangler login

# Set the Gemini key as a secret (from Google AI Studio)
npx wrangler secret put GEMINI_API_KEY

# (Optional but recommended) require a shared key so strangers can't spend your
# Gemini budget — callers must then send it as an X-EduAdmin-Key header:
npx wrangler secret put WORKER_API_KEY

# Ship it
npm run deploy
```

Deployed URL: `https://eduadmin-ai-worker.<your-subdomain>.workers.dev`
(rename the worker in `wrangler.toml` if you like).

## Local development

```bash
cd worker
npm run dev          # runs on http://localhost:8787
# to test the optional auth locally:
npm run dev -- --var WORKER_API_KEY:testkey
```

Note: the Gemini call needs a real key. In local dev without one, requests that
pass validation return `502` (the worker reached Gemini but had no key) — the
validation, CORS, and auth paths still work offline.

## Security note

Without `WORKER_API_KEY` set, this endpoint is public and every call spends your
Gemini quota. Set the secret (above) for anything beyond a quick demo, or put it
behind Cloudflare Access.

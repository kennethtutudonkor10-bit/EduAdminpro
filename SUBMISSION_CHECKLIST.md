# Hackathon Submission Checklist — EduAdmin Pro

Prepared for the Global AI Hackathon (Qwen Cloud) submission.

- **Submission deadline:** July 20, 2026 @ 2:00 PM PST
- **Credit voucher requests close:** July 9, 2026 @ 10:00 AM PST (NOT extended)

This checklist maps the top-5 submission fails to EduAdmin Pro's current state.
Items marked **ACTION NEEDED** require a decision or a step only the maintainer
can take (GitHub settings, deployment, recording).

---

## 1. OSI license — ✅ DONE

- Added an OSI-approved [`LICENSE`](LICENSE) (MIT).
- Reconciled `package.json`: added `"license": "MIT"` and removed the
  contradictory "All rights reserved" copyright string (the README and
  QUICKSTART already advertised the project as open-source).
- README now has a **License** section linking to the file.

## 2. Public repo — ❌ ACTION NEEDED (blocker)

The GitHub repository `kennethtutudonkor10-bit/EduAdminpro` is currently
**private**. Judges cannot open a private repo, and "public repo" is an explicit
eligibility requirement.

**Do this:** GitHub → repo → Settings → General → *Danger Zone* → **Change
repository visibility → Public**, before submitting.

## 3. Proof of deployment — ⚠️ ACTION NEEDED

EduAdmin Pro is offline-first (Electron desktop + local SQLite), so there is no
always-on hosted URL by default. Judges still expect *proof it runs*. Options:

- **Cloudflare Worker (already in this repo):** `worker/` contains a deployable
  AI report-remark endpoint. Run `cd worker && npm install && npm run deploy` to
  get a live `*.workers.dev` URL you can cite as a deployed component.
- **Windows installer:** build with `npm run electron:build:win` and attach the
  installer from `release/` (or link a GitHub Release).
- Capture install + run screenshots for the submission form.

## 4. Working video link — ⚠️ VERIFY

- Ensure the demo video link is **public or unlisted** (not "private").
- Open it in an incognito window to confirm it plays without a login.
- Treat it as a pitch, not a tutorial: problem → who it's for → live demo.

## 5. Eligibility / model provider — ⚠️ ACTION NEEDED (read carefully)

This is a **Qwen Cloud** hackathon, but the AI features currently call **Google
Gemini** (`@google/genai`, `gemini-2.5-flash`) in both `server.ts` and the
Cloudflare `worker/`. Many sponsor hackathons require using the sponsor's model
(Qwen / Alibaba DashScope) to be eligible.

**Do this:** re-read the official rules. If Qwen usage is required, the AI calls
need to be pointed at Qwen (DashScope is OpenAI-API-compatible, so it's a
localized change to the two AI call sites plus the API key/setting). This did
NOT get changed automatically because it's a scope/eligibility decision — flag
it if you'd like it done.

---

## Hardening applied this pass (security)

Fixed a **credential-exposure** issue: school settings store live secrets
(`gemini_api_key`, `hubtel_client_secret`, `api_key`, `registrar_key`,
`webhook_url`, `admin_signature_base64`). Previously any LAN client could read
them in plaintext when no API key was configured, and every secret was baked
into `/api/export` backup files.

- `GET /api/db/settings` and `/api/db/settings/:key` now return secrets in the
  clear **only to the trusted loopback desktop app**; other callers get a
  masked marker (`__eduadmin_secret_set__`).
- `GET /api/export` strips all secret settings from the backup JSON.
- Frontend (`src/App.tsx`) is mask-aware and no longer re-posts a blank/masked
  key on first mount — this also fixes a pre-existing bug where a fresh browser
  could wipe the stored key.

Verified end-to-end: loopback sees real values, LAN sees masks, export is clean,
`tsc --noEmit` passes.

## Minor fixes

- Corrected the dev-server port in `QUICKSTART.md` (was `5173`, actually `3000`).
- Tightened the README pitch (features list, one-line hook, license section).

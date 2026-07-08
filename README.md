# EduAdmin Pro

**Free, offline-first school administration software for Ghanaian and West African schools.**

Runs as a Windows desktop app or a local LAN server — no subscription, no
activation code, and no internet required after install. One tool for the whole
front office: student registry, gradebook, attendance, terminal report cards,
fees, staff directory, an AI admin agent, and parent SMS alerts.

> Built for schools with unreliable power and connectivity: all data lives in a
> local SQLite database, so the app keeps working when the network doesn't.

## Features

- **Student registry** — photo, class, and enrollment tracking
- **Gradebook** — term-based, with configurable continuous-assessment columns
- **Attendance** — per-student daily roll with statistics
- **Report cards** — terminal report generator with single and bulk class printing
- **Fees** — payment ledger and balance tracking
- **Staff directory** — with class assignments
- **AI admin agent** — natural-language Q&A over school data (falls back to a
  rule-based simulation when no API key is set)
- **Parent SMS alerts** — Hubtel/SMSGH gateway-ready notification queue

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) v18 or later.

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Set `GEMINI_API_KEY` in `.env.local` to enable live AI in the Agent
   Console. Without a key the app still runs — the AI console falls back to a
   built-in rule-based simulation.
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3000** (Express serves the app with Vite in middleware
   mode; set `PORT` to change it). Data is stored in SQLite under `./data/`.
5. **Sign in.** On first run a default administrator is created —
   **`admin` / `admin123`** — and you'll be prompted to set a new password
   immediately. Set `EDUADMIN_ADMIN_USERNAME` / `EDUADMIN_ADMIN_PASSWORD` to seed
   your own instead.

## Accounts & roles

Every API request requires authentication. Users have one of two roles:

- **Admin** — full access, including settings, data export, deleting records, and
  managing other users.
- **Teacher** — day-to-day use: view records, enter grades, take attendance.

The Android companion app authenticates with a shared machine key
(`EDUADMIN_API_KEY`, sent as `X-EduAdmin-Key`).

## Data protection

Contact PII — student and staff phone numbers, photos, and staff email — is
encrypted at rest with AES-256-GCM. Provide the key via `EDUADMIN_ENCRYPTION_KEY`
(recommended; keep it out of the data directory), or the app generates a
restricted (`0600`) key file on first run. Fields needed for search and sorting
(names) remain in the clear.

## Desktop app & installer

```bash
npm run build            # bundle the SPA + server
npm run electron:dev     # launch the packaged-style desktop app
npm run electron:build:win   # build the Windows installer (release/)
```

The packaged desktop app binds to `127.0.0.1` only, so its database is never
exposed to the network.

## More

See [QUICKSTART.md](QUICKSTART.md) for the full guide — LAN server mode, optional
`X-EduAdmin-Key` access control, SMS (Hubtel) setup, API endpoints, and log
locations.

## Tech stack

React 19 · TypeScript · Tailwind CSS · Vite · Express · better-sqlite3 · Electron.

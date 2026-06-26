# EduAdmin Pro — Quickstart Guide

Free, open-source school administration software for Ghanaian and West African schools. Runs fully offline as a Windows desktop app. No subscription, no activation code, no internet required after installation.

---

## What's included

- Student register with photo, class, and enrollment tracking
- Term-based gradebook with configurable assessment columns
- Attendance register with per-student daily roll and statistics
- Terminal report card generator with single and bulk class printing
- Fee tracking and payment ledger
- Staff directory with class assignments
- AI agent console for administrative Q&A
- SMS notification queue (Hubtel/SMSGH gateway ready)
- IoT biometric attendance panel (hardware integration roadmap)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Windows 10 / 11 (for the packaged installer)
- npm (bundled with Node.js)

---

## Run in development mode

```bash
npm install
npm run dev
```

This starts the Vite dev server with hot module reload. Open `http://localhost:5173` in your browser.

---

## Run as a desktop app (Electron dev mode)

Build the server bundle first, then launch Electron:

```bash
npm run build
npm run electron:dev
```

The app opens in its own window. Data is stored in `%APPDATA%\eduadmin-pro\school_data.db`.

---

## Build the Windows installer

```bash
npm run electron:build:win
```

The installer is written to `release/EduAdmin Pro Setup 0.0.0.exe`. It installs per-user (no admin rights needed) and creates a desktop shortcut.

> Do not launch the installer's auto-run from an elevated process (e.g. from VS Code running as Administrator). Double-click the desktop shortcut normally instead.

---

## Production server (without Electron)

If you want to run EduAdmin Pro as a local network server so other computers on the school LAN can access it through a browser:

```bash
npm run build
npm start
```

Then open `http://<your-machine-ip>:3000` on any device on the same network.

---

## Database

SQLite — stored at `%APPDATA%\eduadmin-pro\school_data.db` (packaged app) or `./data/school_data.db` (standalone server).

Every fresh database starts with `tier = premium` and `license_status = active` by default. There are no license keys or activation codes.

---

## Configure SMS notifications (optional)

EduAdmin Pro can send parent SMS alerts through the Hubtel (SMSGH) gateway when a student checks in or misses the daily deadline.

Register at [hubtel.com](https://hubtel.com), then POST your credentials to the running server:

```bash
curl -X POST http://localhost:3000/api/db/settings \
  -H "Content-Type: application/json" \
  -d '{"key": "hubtel_client_id", "value": "<your-client-id>"}'

curl -X POST http://localhost:3000/api/db/settings \
  -H "Content-Type: application/json" \
  -d '{"key": "hubtel_client_secret", "value": "<your-client-secret>"}'

curl -X POST http://localhost:3000/api/db/settings \
  -H "Content-Type: application/json" \
  -d '{"key": "hubtel_sender_id", "value": "EduAdmin"}'
```

Check which provider is active:

```bash
curl http://localhost:3000/api/notifications/provider
```

Trigger dispatch of all pending notifications:

```bash
curl -X POST http://localhost:3000/api/notifications/dispatch
```

---

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server liveness check |
| GET | `/api/db/students` | All students |
| GET | `/api/db/scores` | All term scores |
| GET | `/api/db/attendance` | All attendance records |
| GET | `/api/db/staff` | Staff directory |
| GET | `/api/db/settings` | All settings |
| POST | `/api/db/settings` | Write a setting `{ key, value }` |
| GET | `/api/print/students?class=X&q=name` | Filtered student list for print hub |
| GET | `/api/print/compile-bulk?class=X&term=Y` | Full joined class report payload |
| GET | `/api/notifications/pending` | Undelivered SMS queue |
| POST | `/api/notifications/queue` | Add a notification `{ type, message, recipientPhone?, recipientName? }` |
| POST | `/api/notifications/dispatch` | Send all pending via configured provider |
| GET | `/api/notifications/provider` | Active SMS provider status |
| GET | `/api/export` | Full database backup as JSON |

---

## Run integration tests

Verify the notification queue and dispatch pipeline:

```bash
# Start the server first
$env:ELECTRON_RUN_AS_NODE=1; $env:PORT=3000; node_modules\.bin\electron.cmd dist\server.cjs

# In a second terminal
node scripts\test-sms-worker.cjs
```

---

## Log files

| File | Location |
|------|----------|
| Boot crash log | `%USERPROFILE%\eduadmin-boot-error.log` |
| App runtime log | `%APPDATA%\eduadmin-pro\logs\app.log` |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, better-sqlite3 |
| Desktop | Electron 33 |
| Installer | electron-builder (NSIS, per-user) |
| Hardware diagnostics | PowerShell WMI (`Get-NetAdapter`, `Get-PnpDevice`) |

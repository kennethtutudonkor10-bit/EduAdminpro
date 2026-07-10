# Deploy EduAdmin Pro for free (Render)

EduAdmin Pro is an Express + SQLite server, so it needs a persistent Node host —
not a static/serverless platform. **Render's free web service** runs it as-is at
no cost and with no credit card. This takes about 5 minutes.

## Steps

1. Push this branch to GitHub (already done if you're reading this in the repo).
2. Go to **https://render.com** and sign up / log in with your GitHub account.
3. Click **New +** → **Blueprint**.
4. Select the **`EduAdminpro`** repository and the branch
   **`claude/hackathon-deadline-extension-oqgutb`** (or `main` after you merge).
   Render reads [`render.yaml`](render.yaml) and pre-fills everything.
5. When prompted, set the one secret it asks for:
   - **`EDUADMIN_ADMIN_PASSWORD`** → choose a password for the `admin` account.
     (Skip it and the app creates `admin` / `admin123`, forcing a change on first
     login.)
6. Click **Apply** / **Create**. Render installs, builds, and starts the app.
7. When the status is **Live**, open the `https://eduadmin-pro-XXXX.onrender.com`
   URL and sign in as **`admin`** with the password from step 5.

## Good to know

- **First load is slow.** The free service sleeps after ~15 minutes idle; the
  next visit cold-starts in roughly a minute, then it's fast. Hit the URL a
  minute before a demo to "warm" it.
- **Data resets on redeploy/cold start** on the free tier (no persistent disk).
  Fine for a demo. For durable storage, add a Render Disk mounted at `./data`
  (paid) — no code change needed.
- **Health check:** `GET /api/health` returns `{"ok":true}`.
- **Take down the old Vercel deployment** — it can only serve the static
  frontend (login won't work there), so don't submit that URL.

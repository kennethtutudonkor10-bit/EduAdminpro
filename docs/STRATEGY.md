# EduAdmin Pro — Business & Product Strategy

> A working strategy/roadmap document. It is grounded in the current state of this
> repository (desktop Electron app + web SPA + Android companion + Cloudflare AI
> worker + an unfinished Supabase migration). It is meant to be argued with and
> revised, not treated as fixed.

_Last updated: 2026-06-29_

---

## 1. One-line thesis

> **Give the offline desktop app away free to win adoption in West African private
> schools; charge schools a small recurring fee for the *connected* layer (parent
> report delivery, parent portal, cloud backup) once a base of real users exists.**

The free product is the funnel. The connected layer is the business. The two must
stay architecturally separated so the free, offline-first core is never broken by
the paid, online features.

---

## 2. Honest read on the current state

**What's strong**
- Real, unmet pain: small private schools run on paper registers and fragile Excel
  gradebooks. Terminal report cards are a recurring, deadline-driven chore.
- Offline-first desktop (Electron → Express → SQLite) is a genuine differentiator,
  not a limitation — it fits a market with unreliable internet and cash payments.
- Authentic localization: Hubtel/SMSGH SMS, MTN MoMo, GH₵, "Senior High / JHS,"
  district-registrar language, `en-GH` locale detection.
- Frictionless adoption pitch: "free, no internet, no activation code."

**What's weak / unfinished (the honest part)**
- **No path to revenue today.** Billing (`src/lib/billingService.ts`) is entirely a
  mock. Every database defaults to `tier = premium` / `license_status = active`
  (`db.ts`), and the premium gate is client-side `localStorage` with a hardcoded
  master coupon in `src/App.tsx`. There is currently no technical way to charge
  anyone.
- **The monetizable features need the cloud the product avoids.** Parent SMS,
  parent portal, biometric check-in alerts, multi-device sync — these are what
  schools would pay for, but they require connectivity and a backend.
- **Mobile is mid-pivot between two backends.** `EduAdminApiService.kt` targets the
  desktop LAN `/api/v1/*` routes, while `NetworkConfig.kt` has been re-pointed at
  Supabase PostgREST with a `TODO` admitting the migration is incomplete.
- **Duplicated/stale code.** Root `android/` (17 `.kt`) duplicates and diverges from
  `EduAdminMobile/` (24 `.kt`).
- **Solo founder + three platforms + a fourth backend** is the biggest execution
  risk. No CI, no automated tests beyond two manual scripts.

**The central tension to resolve**
The things that make adoption easy (offline, free, trivially unlockable) are the
same things that make revenue nearly impossible. The strategy below resolves this
by *not* trying to license the free desktop app at all, and instead charging for a
clearly separate connected tier.

---

## 3. Business model

### 3.1 Funnel, not paywall
- **Free tier = the entire current desktop app, kept offline and unlicensed.** Do
  not add enforcement. Its job is adoption and trust, not money.
- **Paid tier = the connected layer**, billed to the *school* (not the parent),
  ideally via MoMo standing order on a per-term or monthly cadence.

### 3.2 Who pays, and why
| Buyer | Pays for | Willingness-to-pay driver |
|-------|----------|---------------------------|
| School (head teacher / proprietor) | Parent report delivery, parent portal, cloud backup, multi-device | Saves staff time, looks professional to fee-paying parents, protects data |
| (Not the parent) | — | Parents won't reliably pay; schools have budget and motive |

### 3.3 Pricing hypotheses (to validate, not assume)
- Free desktop app: **GHS 0**, forever.
- Connected tier: **per-term subscription** to the school (round number that maps to
  a small fraction of one student's term fees). Validate the actual number with
  10 head teachers before committing.
- Avoid the one-time GHS 250 license as the core model — it has no recurring revenue
  and cannot be enforced offline.
- SMS has a real per-message cost (Hubtel). Either pass it through, bundle a monthly
  message allowance, or have schools bring their own Hubtel credentials (the server
  already supports per-school Hubtel keys via `settings`).

### 3.4 Why this is probably a lifestyle/impact business, not a venture-scale one
- Bounded market (finite number of private schools in Ghana / nearby markets).
- Recurring revenue is possible but modest per school.
- That is fine. Design for sustainability and impact, not hypergrowth.

---

## 4. Cut-scope plan (do this before building anything new)

Scope is the #1 risk. Reduce surface area first.

1. **Pick one mobile backend.** Decide Express-LAN *or* Supabase and delete the
   other path. (Recommendation: see §6 — Supabase for the paid connected tier, with
   the desktop LAN API kept only for same-network desktop↔mobile use if needed.)
2. **Delete the duplicated root `android/` tree.** Keep only `EduAdminMobile/`.
3. **Freeze or remove the mock billing + coupon code** (`billingService.ts`, coupon
   handler in `App.tsx`) so it is not mistaken for a real entitlement system. If kept
   temporarily, clearly mark it as a non-functional placeholder.
4. **Fix the two correctness bugs surfaced in analysis** (low effort, high signal of
   maturity):
   - Suspicious model id `"gemini-3.5-flash"` in `server.ts` (likely invalid; the
     worker correctly uses `gemini-2.5-flash`).
   - Notification "read" reusing `markNotificationDispatched`, which makes the inbox
     and the SMS send-queue fight over one status column.
5. **Add minimal API protection** before any non-LAN deployment: at least the
   documented `X-EduAdmin-Key` shared-key middleware on `/api/*`, or bind the server
   to localhost instead of `0.0.0.0`.

Outcome: one desktop app, one mobile app, one backend story, no dead code, no
misleading billing.

---

## 5. Validation plan (the real unlock)

You have already proven you can build it. The open question is **whether schools
will pay for the connected parts** — and that is answered by talking to schools, not
by writing more code.

**Step 1 — Free adoption test (this term)**
- Get the free desktop app into **5–10 real schools**.
- Success signal: do they actually use it for daily attendance and terminal reports
  without hand-holding? If schools won't adopt it even for free, the monetization
  question is moot — fix the product, not the pricing.

**Step 2 — Demand discovery**
- Watch what they reach for. Interview the head teachers. Ask which single connected
  feature they would pay for. It is likely **automated parent report/SMS delivery**
  or the **parent portal** — but let them tell you, don't guess.

**Step 3 — Pre-sell before building**
- Offer the top-requested connected feature as a paid term subscription to 2–3
  schools *before* it's fully built. Real MoMo commitment is the only proof that
  matters.

**Kill/continue gates**
- < 3 of 10 schools actively use the free app → product problem, stop and fix.
- Schools use it but none will pay for any connected feature → it's a free tool, not
  a business; decide if that's acceptable as an impact project.
- ≥ 2 schools pre-commit MoMo for a connected feature → build that one feature only.

---

## 6. Technical principle for the paid tier (so it doesn't break offline-first)

Detailed design is a separate document; the guardrails:
- The desktop SQLite database stays the **source of truth on-site**. The cloud is a
  **sync target and delivery channel**, never a hard dependency.
- The app must remain **fully functional with the network unplugged.** Connected
  features degrade gracefully (queue and retry), they don't block core workflows.
- Per-school isolation and auth live in the cloud tier (the Supabase migration
  already models `schools`, `profiles`, roles, and RLS) — not in the free desktop
  app.
- Parent-facing delivery (SMS/WhatsApp/portal) is the natural paid boundary because
  it inherently requires the cloud and has clear per-school value.

---

## 7. Sequenced roadmap

**Phase 0 — Consolidate (now)**
- Execute the §4 cut-scope plan. One app, one mobile, one backend, bugs fixed,
  billing frozen. _Outcome: a clean, honest, shippable free desktop product._

**Phase 1 — Adoption (this term)**
- Polish the free desktop app for real classroom use. Ship to 5–10 schools.
  _Outcome: real usage data and a feedback loop._

**Phase 2 — Discover & pre-sell**
- Run the §5 interviews; identify the one paid feature; pre-sell it.
  _Outcome: validated willingness-to-pay before building._

**Phase 3 — Build the connected tier (only what was pre-sold)**
- Implement the single validated feature on the cloud boundary (§6), with school
  billing via MoMo. _Outcome: first recurring revenue._

**Phase 4 — Expand deliberately**
- Add connected features one at a time, each gated by demand. Resist re-spreading
  across platforms until the business supports it.

---

## 8. Open questions to revisit
- Which mobile backend wins, and can the desktop LAN API be retired entirely?
- Will schools accept per-term MoMo billing, and at what number?
- Bring-your-own-Hubtel vs. bundled SMS allowance — which does the market prefer?
- Is the realistic ceiling a sustainable solo business, and is that the goal?

---

_This document should be updated after the Phase 1 adoption test with real numbers —
schools onboarded, daily-active usage, and the specific paid feature schools name._

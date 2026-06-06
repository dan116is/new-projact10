# 🏗️ פועלים וקבלנים — Workers ⇄ Contractors Marketplace

אפליקציית מובייל שמחברת **פועלים** (workers) ל**קבלנים** (contractors), עם
**מנוי חודשי בתשלום** (monthly subscription) דרך **Stripe**.

A React Native (Expo) mobile app + Node/Express backend. Contractors post jobs,
workers apply, and both sides unlock full functionality behind a recurring
monthly subscription billed through Stripe.

---

## ✨ Features

Built for the **Israeli market** 🇮🇱 — Hebrew, full RTL, ₪ pricing, Israeli trades & cities, and IL mobile-number validation.

- **שני סוגי משתמשים / Two roles** — פועל (worker) או קבלן (contractor), נבחר בהרשמה.
- **מנוי חודשי דו-שכבתי / Two-tier monthly subscription** — **בסיסי** (₪49) ו-**פרו** (₪99) דרך Stripe PaymentSheet, webhook לסנכרון, ו-**תקופת ניסיון חינם** (`STRIPE_TRIAL_DAYS`). מנויי **פרו** מקבלים מיקום מקודם: משרות הקבלן בראש החיפוש, ופרופיל הפועל בראש ספריית הפועלים (תג ⭐).
- **Workflow מלא**: קבלן מפרסם משרה ← פועל מגיש מועמדות ← קבלן מאשר/דוחה ← נפתח צ׳אט ופרטי הקשר נחשפים.
- **Premium gating** — posting jobs (contractors) and applying (workers) require an active subscription (HTTP `402` otherwise).
- **✅ סיום עבודה / Job completion** — the contractor marks a job "הושלמה", which notifies **both** sides to rate each other — closing the trust loop.
- **⭐ דירוגים וביקורות / Ratings & reviews** — both sides rate each other after working together; profiles show an aggregated star rating. Verified "worked-together" requirement + duplicate protection.
- **💬 צ׳אט פנימי / In-app chat** — a conversation opens automatically when an application is accepted; real messaging with unread tracking.
- **🔔 התראות / Notifications** — generated on new applications, acceptances, reviews and messages.
- **✅ אימות / Verification** — a "מאומת" trust badge via a (mock) SMS OTP flow (demo code `1234`).
- **🔎 חיפוש והתאמה / Search & smart matching** — workers get a personalised "מומלצות עבורך" feed ranked by trade + city, plus free-text/trade/city filtering; contractors get a searchable **workers directory** ranked by rating (premium, gated).
- **🔎 לוקליזציה / Localization** — trade & city pickers from curated Israeli lists; VAT (מע"מ 18%) constant available.
- **פרטיות / Privacy** — phone numbers are revealed only **after** an application is accepted.
- JWT auth, profile management, dark RTL Hebrew UI.

---

## 🔁 The Workflow

```
┌─────────────┐      register/login       ┌──────────────────────┐
│   משתמש      │ ─────────────────────────▶│  בחירת תפקיד          │
│   (User)    │                            │  worker / contractor │
└─────────────┘                            └──────────┬───────────┘
                                                       │
                          ┌────────────────────────────┴───────────────────────────┐
                          ▼                                                          ▼
                 ┌──────────────────┐                                      ┌──────────────────┐
                 │   קבלן Contractor │                                      │    פועל Worker    │
                 └────────┬─────────┘                                      └────────┬─────────┘
                          │  💳 subscribe (Stripe)                                  │ 💳 subscribe
                          ▼                                                          ▼
                 ┌──────────────────┐        browse / apply               ┌──────────────────┐
                 │ פרסום משרה        │◀───────────────────────────────────│ עיון במשרות       │
                 │ Post a job (open) │                                     │ Apply (pending)  │
                 └────────┬─────────┘                                      └────────┬─────────┘
                          │  review applicants                                      │
                          ▼                                                          │
                 ┌──────────────────┐   accept ⇒ job=in_progress,                    │
                 │ אישור/דחייה        │   phone numbers revealed  ──────────────────▶ │
                 │ Accept / Reject  │                                                │
                 └──────────────────┘                                      ┌─────────▼────────┐
                                                                           │ 🎉 התקבלת!        │
                                                                           │ Accepted + phone │
                                                                           └──────────────────┘
```

**Subscription state machine** (driven by Stripe webhooks):
`incomplete → active → (cancel_at_period_end) → canceled`. The app reads
`isSubscribed` from `GET /api/auth/me`, computed from the stored subscription
status + current period end.

---

## 📦 Project structure

```
server/                 Node/Express API (JSON-file storage, JWT, Stripe)
  src/
    index.js            app entry + Stripe webhook
    db.js               tiny JSON-file data store
    auth.js             hashing, JWT, requireAuth/Role/Subscription middleware
    stripe.js           Stripe client helpers
    routes/             auth, jobs, applications, subscriptions
    seed.js             demo users + jobs
mobile/                 Expo React Native app
  App.js                StripeProvider + AuthProvider + navigation
  src/
    api.js              fetch wrapper
    context/            AuthContext (token persisted to AsyncStorage)
    navigation/         role-based tabs + stack
    screens/            Auth, Jobs, JobDetail, MyApplications, MyJobs,
                        PostJob, JobApplicants, Paywall, Profile
    components/         shared UI primitives + subscription banner
.github/workflows/ci.yml
```

---

## 🚀 Getting started

### 1. Backend

```bash
cd server
cp .env.example .env          # then fill in your Stripe keys
npm install
npm run seed                  # demo data (optional)
npm run dev                   # http://localhost:4000
```

Demo logins (after `npm run seed`, both have an active demo subscription):

| Role       | Email                | Password   |
| ---------- | -------------------- | ---------- |
| Contractor | `contractor@demo.com`| `demo1234` |
| Worker     | `worker@demo.com`    | `demo1234` |

### 2. Stripe setup (for real billing)

1. Create a Stripe account → grab **test** keys from the Dashboard.
2. Create a **Product** with a **recurring monthly Price** (e.g. ₪49/mo) → copy the `price_…` id.
3. Fill `server/.env`:
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_PRICE_ID=price_…`
   - `STRIPE_PUBLISHABLE_KEY=pk_test_…`
4. Forward webhooks to the server (in another terminal):
   ```bash
   stripe listen --forward-to localhost:4000/api/subscriptions/webhook
   ```
   Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

> Without Stripe keys the API still runs; the seeded users carry a demo
> subscription so you can exercise the full workflow, and the real paywall
> simply reports that Stripe isn't configured.

### 3. Mobile app

```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL + publishable key
npm install
npm start                     # open in Expo Go / simulator
```

Set `EXPO_PUBLIC_API_URL` to match how the device reaches your machine:
`http://localhost:4000` (iOS sim), `http://10.0.2.2:4000` (Android emulator),
or your LAN IP for a physical device. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
to the same `pk_test_…`.

> Stripe PaymentSheet requires a **native build / dev client** (it does not run
> in web). Use the iOS Simulator, an Android emulator, or `expo run:ios|android`.

---

## 🔌 API reference (brief)

| Method | Path                                   | Auth        | Notes                              |
| ------ | -------------------------------------- | ----------- | ---------------------------------- |
| POST   | `/api/auth/register`                   | —           | `{name,email,password,role}`       |
| POST   | `/api/auth/login`                      | —           |                                    |
| GET    | `/api/auth/me`                         | bearer      | includes `isSubscribed`            |
| GET    | `/api/jobs`                            | bearer      | open jobs (filters: trade/location/q/minBudget) |
| GET    | `/api/jobs/recommended`                | worker      | personalised feed ranked by match  |
| GET    | `/api/workers`                         | contractor* | *requires sub — search workers     |
| POST   | `/api/jobs`                            | contractor* | *requires subscription             |
| GET    | `/api/jobs/mine`                       | contractor  |                                    |
| POST   | `/api/applications/jobs/:id/apply`     | worker*     | *requires subscription             |
| GET    | `/api/applications/mine`               | worker      |                                    |
| GET    | `/api/applications/jobs/:jobId`        | contractor  | applicants for a job               |
| PATCH  | `/api/applications/:id`                | contractor  | `{status: accepted\|rejected}`     |
| GET    | `/api/subscriptions/config`            | bearer      | publishable key + price + plan     |
| POST   | `/api/subscriptions/payment-sheet`     | bearer      | returns PaymentSheet params        |
| POST   | `/api/subscriptions/webhook`           | Stripe sig  | raw body                           |
| POST   | `/api/reviews`                         | bearer      | rate a user you worked with        |
| GET    | `/api/reviews/user/:userId`            | bearer      | reviews + average rating           |
| GET    | `/api/conversations`                   | bearer      | my chats                           |
| POST   | `/api/conversations`                   | bearer      | open/find a chat                   |
| GET    | `/api/conversations/:id/messages`      | bearer      | messages (marks read)              |
| POST   | `/api/conversations/:id/messages`      | bearer      | send a message                     |
| GET    | `/api/notifications`                   | bearer      | my notifications + unread count    |
| GET    | `/api/profiles/:userId`                | bearer      | public profile + rating + verified |
| POST   | `/api/profiles/verify`                 | bearer      | mock SMS OTP (demo code `1234`)    |

Premium-gated routes return **`402`** with `{ code: "SUBSCRIPTION_REQUIRED" }`.

---

## 🔒 Security

Hardening applied to the API:

- **Helmet** security headers on every response.
- **Rate limiting** — global API cap plus a stricter limit on `login`/`register` to deter brute force (HTTP `429` with `Retry-After`).
- **Strong-secret enforcement** — the server refuses to boot in `NODE_ENV=production` unless `JWT_SECRET` is set and ≥32 chars.
- **Input validation** — email format, password length, role whitelist, capped field lengths, and a `100kb` JSON body limit.
- **Central error handler** — malformed JSON → `400`, oversized body → `413`, unexpected errors → generic `500` (no stack traces leaked).
- **Least-disclosure** — passwords are bcrypt-hashed and never returned; phone numbers are revealed only after an application is accepted; public profiles omit email/phone.
- **AuthZ everywhere** — every mutating route checks ownership/participation (job owner, conversation participant, "worked-together" rule for reviews).

## 🧪 Tests & CI

- **`npm test`** (in `server/`) runs an integration suite on the built-in `node:test`
  runner against an isolated temp DB — covering auth, validation, subscription
  gating, the full apply→accept→chat→review workflow, authorization, and error handling.
- `.github/workflows/ci.yml` installs both packages, syntax-checks the server,
  **runs the test suite**, boots the API for a `/health` smoke test, and validates
  the mobile config on every push/PR.

---

## ⚠️ Notes

- The backend uses a JSON-file store for zero-setup demos. Swap `db.js` for a
  real database (Postgres/Mongo) before production.
- For production set `NODE_ENV=production`, a long random `JWT_SECRET`
  (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
  an explicit `CORS_ORIGIN`, real Stripe **live** keys, and serve over HTTPS.

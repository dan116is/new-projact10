# 🏗️ פועלים וקבלנים — Workers ⇄ Contractors Marketplace

אפליקציית מובייל שמחברת **פועלים** (workers) ל**קבלנים** (contractors), עם
**מנוי חודשי בתשלום** (monthly subscription) דרך **Stripe**.

A React Native (Expo) mobile app + Node/Express backend. Contractors post jobs,
workers apply, and both sides unlock full functionality behind a recurring
monthly subscription billed through Stripe.

---

## ✨ Features

- **שני סוגי משתמשים / Two roles** — פועל (worker) או קבלן (contractor), נבחר בהרשמה.
- **מנוי חודשי / Monthly subscription** — real Stripe recurring billing via PaymentSheet, with a webhook keeping subscription state in sync.
- **Workflow מלא**:
  - קבלן מפרסם משרה ← פועל מגיש מועמדות ← קבלן מאשר/דוחה ← פרטי קשר נחשפים.
- **Premium gating** — posting jobs (contractors) and applying (workers) require an active subscription (HTTP `402` otherwise).
- **פרטיות / Privacy** — a worker's phone is revealed to the contractor **only after** the application is accepted, and the contractor's phone to the worker only then too.
- JWT auth, profile management, RTL Hebrew UI.

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
| GET    | `/api/jobs`                            | bearer      | open jobs (filters: trade/location)|
| POST   | `/api/jobs`                            | contractor* | *requires subscription             |
| GET    | `/api/jobs/mine`                       | contractor  |                                    |
| POST   | `/api/applications/jobs/:id/apply`     | worker*     | *requires subscription             |
| GET    | `/api/applications/mine`               | worker      |                                    |
| GET    | `/api/applications/jobs/:jobId`        | contractor  | applicants for a job               |
| PATCH  | `/api/applications/:id`                | contractor  | `{status: accepted\|rejected}`     |
| GET    | `/api/subscriptions/config`            | bearer      | publishable key + price            |
| POST   | `/api/subscriptions/payment-sheet`     | bearer      | returns PaymentSheet params        |
| POST   | `/api/subscriptions/webhook`           | Stripe sig  | raw body                           |

Premium-gated routes return **`402`** with `{ code: "SUBSCRIPTION_REQUIRED" }`.

---

## 🧪 CI

`.github/workflows/ci.yml` installs both packages, syntax-checks the server,
boots it for a `/health` smoke test, and validates the mobile config on every push/PR.

---

## ⚠️ Notes

- The backend uses a JSON-file store for zero-setup demos. Swap `db.js` for a
  real database (Postgres/Mongo) before production.
- Use long random `JWT_SECRET`, real Stripe **live** keys, and HTTPS in production.

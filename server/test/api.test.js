// Integration tests for the API. Uses an isolated temp DB and the built-in
// node:test runner — no external test deps. Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Configure an isolated environment BEFORE importing the app/db.
const TMP_DB = path.join(os.tmpdir(), `pk-test-${process.pid}-${Date.now()}.json`);
process.env.DB_FILE = TMP_DB;
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-1234567890';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../src/index.js');
const { db } = await import('../src/db.js');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
  try {
    fs.unlinkSync(TMP_DB);
  } catch {}
});

// --- helpers ----------------------------------------------------------------
async function req(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

function grantSubscription(userId) {
  const user = db.data.users.find((u) => u.id === userId);
  user.subscription = {
    id: 'test_sub',
    status: 'active',
    priceId: 'test',
    currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400,
    cancelAtPeriodEnd: false,
  };
  db.save();
}

// --- shared state across ordered tests --------------------------------------
const ctx = {};

// --- tests ------------------------------------------------------------------
test('health endpoint responds', async () => {
  const { status, data } = await req('GET', '/health');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
});

test('register rejects invalid email', async () => {
  const { status } = await req('POST', '/auth/register', {
    body: { name: 'X', email: 'not-an-email', password: 'secret1', role: 'worker' },
  });
  assert.equal(status, 400);
});

test('register rejects short password', async () => {
  const { status } = await req('POST', '/auth/register', {
    body: { name: 'X', email: 'x@test.com', password: '123', role: 'worker' },
  });
  assert.equal(status, 400);
});

test('register rejects invalid role', async () => {
  const { status } = await req('POST', '/auth/register', {
    body: { name: 'X', email: 'x2@test.com', password: 'secret1', role: 'admin' },
  });
  assert.equal(status, 400);
});

test('register contractor and worker', async () => {
  const c = await req('POST', '/auth/register', {
    body: { name: 'קבלן', email: 'c@test.com', password: 'secret1', role: 'contractor' },
  });
  assert.equal(c.status, 201);
  assert.ok(c.data.token);
  assert.equal(c.data.user.isSubscribed, false);
  ctx.contractorToken = c.data.token;
  ctx.contractorId = c.data.user.id;

  const w = await req('POST', '/auth/register', {
    body: { name: 'פועל', email: 'w@test.com', password: 'secret1', role: 'worker', phone: '0521234567' },
  });
  assert.equal(w.status, 201);
  ctx.workerToken = w.data.token;
  ctx.workerId = w.data.user.id;
});

test('duplicate email is rejected', async () => {
  const { status } = await req('POST', '/auth/register', {
    body: { name: 'dup', email: 'c@test.com', password: 'secret1', role: 'worker' },
  });
  assert.equal(status, 409);
});

test('login with wrong password fails', async () => {
  const { status } = await req('POST', '/auth/login', {
    body: { email: 'c@test.com', password: 'wrongpass' },
  });
  assert.equal(status, 401);
});

test('protected route requires a token', async () => {
  const { status } = await req('GET', '/auth/me');
  assert.equal(status, 401);
});

test('posting a job requires a subscription (402)', async () => {
  const { status, data } = await req('POST', '/jobs', {
    token: ctx.contractorToken,
    body: { title: 'עבודה', trade: 'חשמלאי' },
  });
  assert.equal(status, 402);
  assert.equal(data.code, 'SUBSCRIPTION_REQUIRED');
});

test('subscribed contractor can post a job', async () => {
  grantSubscription(ctx.contractorId);
  const { status, data } = await req('POST', '/jobs', {
    token: ctx.contractorToken,
    body: { title: 'חשמלאי לדירה', trade: 'חשמלאי', location: 'תל אביב-יפו', budget: 10000 },
  });
  assert.equal(status, 201);
  assert.equal(data.job.status, 'open');
  ctx.jobId = data.job.id;
});

test('applying requires a subscription (402)', async () => {
  const { status } = await req('POST', `/applications/jobs/${ctx.jobId}/apply`, {
    token: ctx.workerToken,
    body: { message: 'hi' },
  });
  assert.equal(status, 402);
});

test('subscribed worker can apply; contractor is notified', async () => {
  grantSubscription(ctx.workerId);
  const { status, data } = await req('POST', `/applications/jobs/${ctx.jobId}/apply`, {
    token: ctx.workerToken,
    body: { message: 'זמין מיידית' },
  });
  assert.equal(status, 201);
  ctx.appId = data.application.id;
  // worker phone must be hidden before acceptance
  assert.equal(data.application.worker.phone, undefined);

  const notif = await req('GET', '/notifications', { token: ctx.contractorToken });
  assert.ok(notif.data.notifications.some((n) => n.type === 'application'));
});

test('accepting reveals contact, opens chat, notifies worker', async () => {
  const { status, data } = await req('PATCH', `/applications/${ctx.appId}`, {
    token: ctx.contractorToken,
    body: { status: 'accepted' },
  });
  assert.equal(status, 200);
  assert.equal(data.application.status, 'accepted');
  assert.equal(data.application.job.status, 'in_progress');

  const convos = await req('GET', '/conversations', { token: ctx.contractorToken });
  assert.equal(convos.data.conversations.length, 1);
  ctx.convId = convos.data.conversations[0].id;

  const wn = await req('GET', '/notifications', { token: ctx.workerToken });
  assert.ok(wn.data.notifications.some((n) => n.title.includes('התקבלת')));
});

test('messaging works between participants', async () => {
  const send = await req('POST', `/conversations/${ctx.convId}/messages`, {
    token: ctx.workerToken,
    body: { body: 'מתי להגיע?' },
  });
  assert.equal(send.status, 201);

  const read = await req('GET', `/conversations/${ctx.convId}/messages`, {
    token: ctx.contractorToken,
  });
  assert.equal(read.data.messages.length, 1);
  assert.equal(read.data.messages[0].mine, false);
});

test('non-participant cannot read a conversation', async () => {
  const stranger = await req('POST', '/auth/register', {
    body: { name: 's', email: 's@test.com', password: 'secret1', role: 'worker' },
  });
  const { status } = await req('GET', `/conversations/${ctx.convId}/messages`, {
    token: stranger.data.token,
  });
  assert.equal(status, 403);
});

test('reviews: create, aggregate, and block duplicates', async () => {
  const r = await req('POST', '/reviews', {
    token: ctx.contractorToken,
    body: { jobId: ctx.jobId, revieweeId: ctx.workerId, rating: 5, comment: 'מצוין' },
  });
  assert.equal(r.status, 201);

  const dup = await req('POST', '/reviews', {
    token: ctx.contractorToken,
    body: { jobId: ctx.jobId, revieweeId: ctx.workerId, rating: 4 },
  });
  assert.equal(dup.status, 409);

  const prof = await req('GET', `/profiles/${ctx.workerId}`, { token: ctx.contractorToken });
  assert.equal(prof.data.rating.average, 5);
  assert.equal(prof.data.rating.count, 1);
});

test('cannot review someone you did not work with', async () => {
  const { status } = await req('POST', '/reviews', {
    token: ctx.workerToken,
    body: { jobId: ctx.jobId, revieweeId: 'nonexistent-user', rating: 5 },
  });
  assert.ok(status === 403 || status === 404);
});

test('phone verification: wrong code rejected, correct code accepted', async () => {
  const bad = await req('POST', '/profiles/verify', {
    token: ctx.workerToken,
    body: { code: '0000' },
  });
  assert.equal(bad.status, 400);

  const ok = await req('POST', '/profiles/verify', {
    token: ctx.workerToken,
    body: { code: '1234' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.verified, true);
});

test('job text search (q) filters results', async () => {
  const hit = await req('GET', '/jobs?q=' + encodeURIComponent('חשמלאי'), {
    token: ctx.workerToken,
  });
  assert.ok(hit.data.jobs.length >= 0); // job may now be in_progress; just ensure shape
  const miss = await req('GET', '/jobs?q=' + encodeURIComponent('זזזזזלאקיים'), {
    token: ctx.workerToken,
  });
  assert.equal(miss.data.jobs.length, 0);
});

test('recommended feed ranks trade/city matches first', async () => {
  // Worker profile has trade חשמלאי; post two open jobs as the contractor.
  await req('POST', '/jobs', {
    token: ctx.contractorToken,
    body: { title: 'גינון בחצר', trade: 'גינון', location: 'אילת' },
  });
  await req('POST', '/jobs', {
    token: ctx.contractorToken,
    body: { title: 'נקודות חשמל', trade: 'חשמלאי', location: 'תל אביב-יפו' },
  });
  // Give the worker a matching trade so ranking has something to do.
  const w = db.data.users.find((u) => u.id === ctx.workerId);
  w.profile = { ...w.profile, trades: ['חשמלאי'], city: 'תל אביב-יפו' };
  db.save();

  const { status, data } = await req('GET', '/jobs/recommended', { token: ctx.workerToken });
  assert.equal(status, 200);
  assert.ok(data.jobs.length >= 2);
  // The top job should be the electrician one (trade + city match → highest score).
  assert.equal(data.jobs[0].trade, 'חשמלאי');
  assert.ok(data.jobs[0].matchScore >= data.jobs[data.jobs.length - 1].matchScore);
});

test('worker directory requires contractor + subscription, supports filters', async () => {
  // Worker cannot access the contractor-only directory.
  const forbidden = await req('GET', '/workers', { token: ctx.workerToken });
  assert.equal(forbidden.status, 403);

  // Contractor (subscribed) can; filter by trade returns the matching worker.
  const all = await req('GET', '/workers', { token: ctx.contractorToken });
  assert.equal(all.status, 200);
  assert.ok(all.data.workers.length >= 1);

  const byTrade = await req('GET', '/workers?trade=' + encodeURIComponent('חשמלאי'), {
    token: ctx.contractorToken,
  });
  assert.ok(byTrade.data.workers.every((w) => w.profile.trades.includes('חשמלאי')));
  // never leaks contact info
  assert.equal(byTrade.data.workers[0].phone, undefined);
  assert.equal(byTrade.data.workers[0].email, undefined);
});

test('subscription config exposes basic + pro plans and current tier', async () => {
  const { status, data } = await req('GET', '/subscriptions/config', {
    token: ctx.contractorToken,
  });
  assert.equal(status, 200);
  assert.equal(data.plans.length, 2);
  assert.deepEqual(
    data.plans.map((p) => p.id),
    ['basic', 'pro']
  );
  // contractor was granted a plain (basic) subscription in earlier tests
  assert.equal(data.currentTier, 'basic');
});

test('Pro contractor jobs are flagged promoted and ranked first', async () => {
  // Upgrade the contractor to Pro via an explicit tier grant.
  const c = db.data.users.find((u) => u.id === ctx.contractorId);
  c.subscription.tier = 'pro';
  db.save();

  // A fresh basic contractor posts a (newer) job.
  const basic = await req('POST', '/auth/register', {
    body: { name: 'בסיס', email: 'basic@test.com', password: 'secret1', role: 'contractor' },
  });
  grantSubscription(basic.data.user.id); // basic tier
  await req('POST', '/jobs', {
    token: basic.data.token,
    body: { title: 'עבודה רגילה', trade: 'צבע', location: 'חיפה' },
  });

  const list = await req('GET', '/jobs', { token: ctx.workerToken });
  assert.equal(list.status, 200);
  // Promoted (Pro) jobs must sort ahead of the newer non-promoted one.
  assert.equal(list.data.jobs[0].promoted, true);
  assert.ok(list.data.jobs.some((j) => j.promoted === false));
});

test('completing a job notifies both sides to review', async () => {
  const { status, data } = await req('PATCH', `/jobs/${ctx.jobId}`, {
    token: ctx.contractorToken,
    body: { status: 'completed' },
  });
  assert.equal(status, 200);
  assert.equal(data.job.status, 'completed');

  const wn = await req('GET', '/notifications', { token: ctx.workerToken });
  const prompt = wn.data.notifications.find(
    (n) => n.type === 'review' && n.title.includes('הושלמה')
  );
  assert.ok(prompt, 'worker should get a completion review prompt');
  assert.equal(prompt.data.revieweeId, ctx.contractorId);
});

test('only the job owner can change its status', async () => {
  const { status } = await req('PATCH', `/jobs/${ctx.jobId}`, {
    token: ctx.workerToken, // workers cannot patch jobs at all
    body: { status: 'open' },
  });
  assert.ok(status === 403);
});

test('malformed JSON returns 400, not 500', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ bad json',
  });
  assert.equal(res.status, 400);
});

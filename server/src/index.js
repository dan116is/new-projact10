import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './db.js';
import { getStripe, stripeConfigured, toStoredSubscription } from './stripe.js';
import { rateLimit } from './security.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import subscriptionRoutes from './routes/subscriptions.js';
import notificationRoutes from './routes/notifications.js';
import reviewRoutes from './routes/reviews.js';
import conversationRoutes from './routes/conversations.js';
import profileRoutes from './routes/profiles.js';
import workerRoutes from './routes/workers.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust the first proxy hop so req.ip reflects the real client (for rate limiting).
app.set('trust proxy', 1);

// Security headers.
app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  })
);

// --- Stripe webhook MUST receive the raw body, so mount it before express.json ---
app.post(
  '/api/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    // Fail closed: never trust an unsigned body. A valid signing secret is
    // mandatory — without it we cannot prove the event came from Stripe, so an
    // attacker could otherwise forge subscription state for any user.
    if (!secret || secret.startsWith('whsec_xxx')) {
      console.error('Webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    let event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      handleStripeEvent(event);
    } catch (err) {
      console.error('Webhook handler error:', err.message);
    }
    res.json({ received: true });
  }
);

app.use(express.json({ limit: '100kb' }));

// General API rate limit + a stricter one on auth to deter brute force.
app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }));
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: 'יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות.',
});

// Sync a subscription object from Stripe onto the owning user.
function syncSubscription(subscription) {
  const customerId = subscription.customer;
  const userId = subscription.metadata?.userId;
  const user =
    db.data.users.find((u) => u.id === userId) ||
    db.data.users.find((u) => u.stripeCustomerId === customerId);
  if (!user) return;
  user.subscription = toStoredSubscription(subscription);
  db.save();
  console.log(`Subscription ${subscription.id} -> ${subscription.status} for ${user.email}`);
}

function handleStripeEvent(event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      syncSubscription(event.data.object);
      break;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (subId && stripeConfigured()) {
        // Re-fetch to get the authoritative status + period end.
        getStripe()
          .subscriptions.retrieve(subId)
          .then(syncSubscription)
          .catch((e) => console.error('invoice sync error:', e.message));
      }
      break;
    }
    default:
      // Ignore other event types.
      break;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    stripeConfigured: stripeConfigured(),
    users: db.data.users.length,
    jobs: db.data.jobs.length,
  });
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/workers', workerRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the app so tests can import it without binding a port.
export default app;

// Start the server only when run directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`Stripe configured: ${stripeConfigured()}`);
  });
}

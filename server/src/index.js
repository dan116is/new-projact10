import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { getStripe, stripeConfigured, toStoredSubscription } from './stripe.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import subscriptionRoutes from './routes/subscriptions.js';

const app = express();
const PORT = process.env.PORT || 4000;

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
    let event;
    try {
      if (secret && !secret.startsWith('whsec_xxx')) {
        event = getStripe().webhooks.constructEvent(req.body, sig, secret);
      } else {
        // No signing secret configured (local dev): trust the parsed body.
        event = JSON.parse(req.body.toString('utf-8'));
      }
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

app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Stripe configured: ${stripeConfigured()}`);
});

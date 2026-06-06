// Subscription billing via Stripe.
//
// Flow (PaymentSheet on mobile):
//   1. POST /subscriptions/payment-sheet
//        -> ensures a Stripe Customer, creates an incomplete Subscription,
//           returns { paymentIntentClientSecret, ephemeralKey, customerId, publishableKey }
//   2. The app presents Stripe PaymentSheet with those values.
//   3. On success, Stripe fires `invoice.paid` / `customer.subscription.updated`
//        to our webhook, which flips the user to "active".
//   4. The app refreshes GET /auth/me and sees isSubscribed: true.
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, publicUser, subscriptionTier } from '../auth.js';
import { getStripe, stripeConfigured, toStoredSubscription } from '../stripe.js';

const router = Router();

// Expose pricing / plans so the app can render the paywall.
router.get('/config', requireAuth, (req, res) => {
  const isContractor = req.user.role === 'contractor';
  const basicPerks = isContractor
    ? [
        'פרסום משרות ללא הגבלה',
        'גישה לכל הפועלים המאומתים',
        'צ׳אט ישיר עם מועמדים',
        'דירוגים וביקורות לבניית מוניטין',
        'התראות בזמן אמת על מועמדים חדשים',
      ]
    : [
        'גישה לכל המשרות הפתוחות',
        'הגשת מועמדות ללא הגבלה',
        'צ׳אט ישיר עם קבלנים',
        'פרופיל מקצועי עם דירוגים',
        'התראות על משרות שמתאימות לך',
      ];
  const proExtras = isContractor
    ? ['⭐ המשרות שלך מקודמות ובראש החיפוש', '🏅 תג "פרו" בולט', 'עדיפות בתוצאות לפועלים']
    : ['⭐ הפרופיל שלך בראש ספריית הפועלים', '🏅 תג "פרו" בולט', 'עדיפות מול קבלנים'];

  const plans = [
    {
      id: 'basic',
      name: 'בסיסי',
      priceLabel: process.env.SUBSCRIPTION_PRICE_LABEL || '₪49 / חודש',
      priceId: process.env.STRIPE_PRICE_ID || null,
      perks: basicPerks,
    },
    {
      id: 'pro',
      name: 'פרו',
      priceLabel: process.env.SUBSCRIPTION_PRICE_LABEL_PRO || '₪99 / חודש',
      priceId: process.env.STRIPE_PRICE_ID_PRO || null,
      perks: [...basicPerks, ...proExtras],
      recommended: true,
    },
  ];

  res.json({
    configured: stripeConfigured(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    trialDays: Number(process.env.STRIPE_TRIAL_DAYS || 0),
    currentTier: subscriptionTier(req.user),
    currency: 'ils',
    plans,
    // Backward-compatible single-plan field (basic).
    plan: { name: plans[0].name, priceLabel: plans[0].priceLabel, perks: basicPerks },
  });
});

async function ensureCustomer(user) {
  const stripe = getStripe();
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (existing && !existing.deleted) return user.stripeCustomerId;
    } catch {
      // fall through and recreate
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id, role: user.role },
  });
  user.stripeCustomerId = customer.id;
  db.save();
  return customer.id;
}

router.post('/payment-sheet', requireAuth, async (req, res) => {
  try {
    if (!stripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured on the server' });
    }
    // Pick the price for the requested plan tier ('basic' default, or 'pro').
    const plan = req.body?.plan === 'pro' ? 'pro' : 'basic';
    const priceId =
      plan === 'pro' ? process.env.STRIPE_PRICE_ID_PRO : process.env.STRIPE_PRICE_ID;
    if (!priceId || priceId.startsWith('price_xxx')) {
      return res.status(503).json({
        error:
          plan === 'pro'
            ? 'STRIPE_PRICE_ID_PRO is not configured'
            : 'STRIPE_PRICE_ID is not configured',
      });
    }
    const stripe = getStripe();
    const customerId = await ensureCustomer(req.user);

    // Reuse an existing incomplete subscription if the user retries.
    let subscription;
    const existing = req.user.subscription;
    if (existing?.id && ['incomplete', 'past_due'].includes(existing.status)) {
      subscription = await stripe.subscriptions.retrieve(existing.id, {
        expand: ['latest_invoice.payment_intent'],
      });
    }
    if (!subscription || subscription.status === 'canceled') {
      // Optional free trial (e.g. 7 days) — strong conversion lever.
      const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 0);
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId: req.user.id, plan },
      });
    }

    // Persist the tier so the UI reflects it immediately (webhook confirms later).
    req.user.subscription = { ...toStoredSubscription(subscription), tier: plan };
    db.save();

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' }
    );

    const paymentIntent = subscription.latest_invoice?.payment_intent;
    res.json({
      subscriptionId: subscription.id,
      paymentIntentClientSecret: paymentIntent?.client_secret || null,
      ephemeralKey: ephemeralKey.secret,
      customerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (err) {
    console.error('payment-sheet error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Pull latest subscription state from Stripe (fallback when webhooks aren't wired).
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    if (!req.user.subscription?.id || !stripeConfigured()) {
      return res.json({ user: publicUser(req.user) });
    }
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(req.user.subscription.id);
    req.user.subscription = toStoredSubscription(sub);
    db.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    console.error('refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cancel at period end (keeps access until the paid period ends).
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    if (!req.user.subscription?.id || !stripeConfigured()) {
      return res.status(400).json({ error: 'No active subscription' });
    }
    const stripe = getStripe();
    const sub = await stripe.subscriptions.update(req.user.subscription.id, {
      cancel_at_period_end: true,
    });
    req.user.subscription = toStoredSubscription(sub);
    db.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    console.error('cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

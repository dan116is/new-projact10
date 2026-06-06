// Stripe client + subscription helpers.
import Stripe from 'stripe';

let stripe = null;

export function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_xxx')) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Copy .env.example to .env and set it.'
    );
  }
  stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  return stripe;
}

export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && !key.startsWith('sk_test_xxx'));
}

// Map a Stripe subscription object onto the shape we persist on the user.
export function toStoredSubscription(sub) {
  return {
    id: sub.id,
    status: sub.status,
    priceId: sub.items?.data?.[0]?.price?.id || null,
    currentPeriodEnd: sub.current_period_end || null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || false,
  };
}

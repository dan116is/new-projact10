// Workers directory: lets contractors search & discover available workers.
// Premium contractor feature — drives the value of the subscription.
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, requireSubscription, isPro } from '../auth.js';

const router = Router();

// Rating summary for a user, computed from reviews.
function ratingFor(userId) {
  const reviews = db.data.reviews.filter((r) => r.revieweeId === userId);
  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : null;
  return { average, count };
}

// Public worker card — never exposes email/phone.
// Pro workers are flagged `promoted` for badge + top placement.
function publicWorker(user) {
  return {
    id: user.id,
    name: user.name,
    verified: !!user.verified,
    promoted: isPro(user),
    profile: {
      trades: user.profile?.trades || [],
      city: user.profile?.city || null,
      hourlyRate: user.profile?.hourlyRate ?? null,
      experienceYears: user.profile?.experienceYears ?? null,
    },
    rating: ratingFor(user.id),
  };
}

// GET /api/workers?trade=&city=&q= — search workers, ranked by rating then verified.
router.get('/', requireAuth, requireRole('contractor'), requireSubscription, (req, res) => {
  const { trade, city, q } = req.query;
  let workers = db.data.users.filter((u) => u.role === 'worker');

  if (trade) {
    const t = String(trade).toLowerCase();
    workers = workers.filter((u) =>
      (u.profile?.trades || []).some((x) => x.toLowerCase() === t)
    );
  }
  if (city) {
    const c = String(city).toLowerCase();
    workers = workers.filter((u) => (u.profile?.city || '').toLowerCase().includes(c));
  }
  if (q) {
    const needle = String(q).toLowerCase();
    workers = workers.filter((u) =>
      [u.name, u.profile?.city, ...(u.profile?.trades || [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    );
  }

  const cards = workers.map(publicWorker).sort((a, b) => {
    if (a.promoted !== b.promoted) return Number(b.promoted) - Number(a.promoted);
    const ra = a.rating.average ?? -1;
    const rb = b.rating.average ?? -1;
    if (rb !== ra) return rb - ra;
    return Number(b.verified) - Number(a.verified);
  });

  res.json({ workers: cards });
});

export default router;

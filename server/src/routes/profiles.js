// Profiles: public user view + mock OTP phone verification.
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// GET /api/profiles/:userId — public profile (no sensitive fields).
router.get('/:userId', requireAuth, (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const reviews = db.data.reviews.filter((r) => r.revieweeId === user.id);
  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : null;

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
    profile: user.profile || null,
    verified: !!user.verified,
    rating: { average, count },
  });
});

// POST /api/profiles/verify — mock OTP: code '1234' sets verified = true.
router.post('/verify', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (String(code) !== '1234') {
    return res.status(400).json({ error: 'קוד שגוי' });
  }
  // Mutate the live object — db.data.users holds the same reference.
  req.user.verified = true;
  db.save();
  res.json({ ok: true, verified: true });
});

export default router;

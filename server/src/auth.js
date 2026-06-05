// Auth helpers: password hashing, JWT issuing/verifying, and Express middleware.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// Refuse to run in production with a weak/default signing secret.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || JWT_SECRET === 'dev-insecure-secret' || JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value (>=32 chars) in production.'
    );
  }
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Strip sensitive fields before returning a user to the client.
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, stripeCustomerId, ...rest } = user;
  return {
    ...rest,
    verified: !!user.verified,
    isSubscribed: isSubscriptionActive(user),
  };
}

export function isSubscriptionActive(user) {
  const sub = user?.subscription;
  if (!sub) return false;
  if (!['active', 'trialing'].includes(sub.status)) return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd * 1000 < Date.now()) return false;
  return true;
}

// Requires a valid bearer token. Attaches req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.data.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Restrict a route to a specific role ('worker' | 'contractor').
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
}

// Gate premium features behind an active subscription.
export function requireSubscription(req, res, next) {
  if (!isSubscriptionActive(req.user)) {
    return res.status(402).json({
      error: 'Active subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
  next();
}

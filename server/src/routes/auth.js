// Registration, login, and "who am I" endpoints.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  requireAuth,
} from '../auth.js';
import { isValidEmail, isValidPassword, PASSWORD_MIN, clip } from '../security.js';

const router = Router();

const ROLES = ['worker', 'contractor'];

router.post('/register', (req, res) => {
  const { name, email, password, role, phone, profile } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'כתובת אימייל לא תקינה' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: `הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN} תווים` });
  }
  if (db.data.users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = {
    id: randomUUID(),
    role,
    name: clip(name, 80),
    email: normalizedEmail,
    phone: phone ? clip(phone, 20) : null,
    passwordHash: hashPassword(String(password)),
    // Free-form, role-specific profile (trades, hourly rate, company name, etc.)
    profile: profile && typeof profile === 'object' ? profile : {},
    stripeCustomerId: null,
    subscription: null,
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.save();

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.data.users.find((u) => u.email === normalizedEmail);
  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Update the current user's profile (name, phone, profile blob).
router.patch('/me', requireAuth, (req, res) => {
  const { name, phone, profile } = req.body || {};
  if (name !== undefined) req.user.name = clip(name, 80);
  if (phone !== undefined) req.user.phone = phone ? clip(phone, 20) : null;
  if (profile !== undefined && typeof profile === 'object') {
    req.user.profile = { ...req.user.profile, ...profile };
  }
  db.save();
  res.json({ user: publicUser(req.user) });
});

export default router;

// Lightweight security helpers — no external deps beyond helmet.
// A tiny in-memory rate limiter (sufficient for a single-instance API) and
// input validation/sanitisation utilities.

// --- Rate limiting -----------------------------------------------------------
// Fixed-window limiter keyed by client IP. Returns Express middleware.
export function rateLimit({ windowMs = 60_000, max = 60, message } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Opportunistically drop expired buckets so the map can't grow unbounded.
  function sweep(now) {
    for (const [ip, b] of hits) if (b.resetAt <= now) hits.delete(ip);
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (hits.size > 5000) sweep(now);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = hits.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: message || 'יותר מדי בקשות, נסו שוב מאוחר יותר' });
    }
    next();
  };
}

// --- Validation --------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

export const PASSWORD_MIN = 6;

export function isValidPassword(value) {
  return typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= 200;
}

// Coerce to a trimmed string capped at `max` chars (defends against abuse / bloat).
export function clip(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

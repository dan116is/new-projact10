// Notifications: list, mark-one-read, mark-all-read.
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// GET /api/notifications — caller's notifications newest first.
router.get('/', requireAuth, (req, res) => {
  const notifications = db.data.notifications
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

// POST /api/notifications/read-all — mark every notification mine as read.
router.post('/read-all', requireAuth, (req, res) => {
  db.data.notifications
    .filter((n) => n.userId === req.user.id && !n.read)
    .forEach((n) => {
      n.read = true;
    });
  db.save();
  res.json({ ok: true });
});

// POST /api/notifications/:id/read — mark a single notification read.
router.post('/:id/read', requireAuth, (req, res) => {
  const notification = db.data.notifications.find((n) => n.id === req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  if (notification.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not your notification' });
  }
  notification.read = true;
  db.save();
  res.json({ ok: true });
});

export default router;

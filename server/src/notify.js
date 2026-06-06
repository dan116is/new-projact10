// Push an in-app notification to a user and persist immediately.
import { randomUUID } from 'crypto';
import { db } from './db.js';

export function pushNotification(userId, { type, title, body, data }) {
  const notification = {
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    data: data || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.data.notifications.push(notification);
  db.save();
  return notification;
}

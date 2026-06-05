// Conversations & messages: two-party threaded chat, optionally tied to a job.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { pushNotification } from '../notify.js';

const router = Router();

// Resolve the other participant in a conversation relative to the calling user.
function otherParticipant(conv, myId) {
  const otherId = conv.participantIds.find((id) => id !== myId);
  const user = db.data.users.find((u) => u.id === otherId);
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

// Compute last message and unread count for a conversation.
function convMeta(conv, myId) {
  const msgs = db.data.messages.filter((m) => m.conversationId === conv.id);
  const sorted = [...msgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = sorted[sorted.length - 1] || null;
  const unreadCount = msgs.filter((m) => m.senderId !== myId && !m.readBy.includes(myId)).length;
  return {
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, senderId: last.senderId } : null,
    unreadCount,
  };
}

// GET /api/conversations — caller's conversations sorted by lastMessageAt desc.
router.get('/', requireAuth, (req, res) => {
  const myId = req.user.id;
  const convs = db.data.conversations.filter((c) => c.participantIds.includes(myId));

  const result = convs
    .map((c) => {
      const other = otherParticipant(c, myId);
      const { lastMessage, unreadCount } = convMeta(c, myId);
      return {
        id: c.id,
        jobId: c.jobId,
        otherUser: other,
        lastMessage,
        unreadCount,
        lastMessageAt: c.lastMessageAt,
      };
    })
    .sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });

  res.json({ conversations: result });
});

// POST /api/conversations — find or create a conversation with another user.
router.post('/', requireAuth, (req, res) => {
  const myId = req.user.id;
  const { otherUserId, jobId } = req.body || {};

  if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

  const otherUser = db.data.users.find((u) => u.id === otherUserId);
  if (!otherUser) return res.status(404).json({ error: 'User not found' });

  const normalizedJobId = jobId || null;

  // Find an existing conversation with the same pair and jobId.
  const existing = db.data.conversations.find(
    (c) =>
      c.participantIds.includes(myId) &&
      c.participantIds.includes(otherUserId) &&
      c.participantIds.length === 2 &&
      (c.jobId || null) === normalizedJobId
  );

  if (existing) {
    return res.json({
      conversation: {
        id: existing.id,
        jobId: existing.jobId,
        otherUser: { id: otherUser.id, name: otherUser.name, role: otherUser.role },
      },
    });
  }

  const conversation = {
    id: randomUUID(),
    participantIds: [myId, otherUserId],
    jobId: normalizedJobId,
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
  };
  db.data.conversations.push(conversation);
  db.save();

  res.status(201).json({
    conversation: {
      id: conversation.id,
      jobId: conversation.jobId,
      otherUser: { id: otherUser.id, name: otherUser.name, role: otherUser.role },
    },
  });
});

// GET /api/conversations/:id/messages — fetch messages; mark unread ones read.
router.get('/:id/messages', requireAuth, (req, res) => {
  const myId = req.user.id;
  const conv = db.data.conversations.find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.participantIds.includes(myId)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  // Mark all unread messages in this conversation as read for me.
  let dirty = false;
  db.data.messages
    .filter((m) => m.conversationId === conv.id && !m.readBy.includes(myId))
    .forEach((m) => {
      m.readBy.push(myId);
      dirty = true;
    });
  if (dirty) db.save();

  const messages = db.data.messages
    .filter((m) => m.conversationId === conv.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === myId,
    }));

  const otherId = conv.participantIds.find((id) => id !== myId);
  const other = db.data.users.find((u) => u.id === otherId);
  const otherUser = other ? { id: other.id, name: other.name, role: other.role } : null;

  res.json({ messages, otherUser });
});

// POST /api/conversations/:id/messages — send a message.
router.post('/:id/messages', requireAuth, (req, res) => {
  const myId = req.user.id;
  const conv = db.data.conversations.find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.participantIds.includes(myId)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const body = req.body?.body ? String(req.body.body).trim() : '';
  if (!body) return res.status(400).json({ error: 'body is required' });

  const now = new Date().toISOString();
  const message = {
    id: randomUUID(),
    conversationId: conv.id,
    senderId: myId,
    body,
    readBy: [myId],
    createdAt: now,
  };
  db.data.messages.push(message);
  conv.lastMessageAt = now;
  db.save();

  const otherId = conv.participantIds.find((id) => id !== myId);
  const truncated = body.length > 60 ? body.slice(0, 60) + '…' : body;
  pushNotification(otherId, {
    type: 'message',
    title: `הודעה חדשה מ${req.user.name}`,
    body: truncated,
    data: { conversationId: conv.id },
  });

  res.status(201).json({ message: { id: message.id, senderId: message.senderId, body: message.body, createdAt: message.createdAt, mine: true } });
});

export default router;

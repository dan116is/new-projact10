// Extra API endpoints for messaging, notifications, reviews and profiles.
// Mirrors the style of api.js — same request pattern, same error handling.
import { API_BASE_URL, ApiError } from './api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError('לא ניתן להתחבר לשרת. ודא שה-API פועל.', 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data.error || 'אירעה שגיאה', res.status, data.code);
  }
  return data;
}

export const apiExtra = {
  // Notifications
  notifications: (token) =>
    request('/notifications', { token }),
  markAllNotificationsRead: (token) =>
    request('/notifications/read-all', { method: 'POST', token }),

  // Reviews
  userReviews: (userId, token) =>
    request(`/reviews/user/${userId}`, { token }),
  createReview: (body, token) =>
    request('/reviews', { method: 'POST', body, token }),

  // Conversations & messages
  conversations: (token) =>
    request('/conversations', { token }),
  openConversation: (body, token) =>
    request('/conversations', { method: 'POST', body, token }),
  conversationMessages: (id, token) =>
    request(`/conversations/${id}/messages`, { token }),
  sendMessage: (id, body, token) =>
    request(`/conversations/${id}/messages`, { method: 'POST', body, token }),

  // Profiles
  profile: (userId, token) =>
    request(`/profiles/${userId}`, { token }),
  verifyPhone: (code, token) =>
    request('/profiles/verify', { method: 'POST', body: { code }, token }),
};

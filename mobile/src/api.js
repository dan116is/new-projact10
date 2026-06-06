// Thin fetch wrapper around the backend API.
import Constants from 'expo-constants';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:4000';

export const API_BASE_URL = BASE_URL;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
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

export const api = {
  // auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: (token) => request('/auth/me', { token }),
  updateMe: (body, token) => request('/auth/me', { method: 'PATCH', body, token }),

  // jobs
  listJobs: (token, query = '') => request(`/jobs${query}`, { token }),
  recommendedJobs: (token) => request('/jobs/recommended', { token }),
  myJobs: (token) => request('/jobs/mine', { token }),
  getJob: (id, token) => request(`/jobs/${id}`, { token }),
  createJob: (body, token) => request('/jobs', { method: 'POST', body, token }),
  updateJob: (id, body, token) => request(`/jobs/${id}`, { method: 'PATCH', body, token }),
  deleteJob: (id, token) => request(`/jobs/${id}`, { method: 'DELETE', token }),

  // applications
  applyToJob: (jobId, body, token) =>
    request(`/applications/jobs/${jobId}/apply`, { method: 'POST', body, token }),
  myApplications: (token) => request('/applications/mine', { token }),
  jobApplications: (jobId, token) => request(`/applications/jobs/${jobId}`, { token }),
  decideApplication: (id, status, token) =>
    request(`/applications/${id}`, { method: 'PATCH', body: { status }, token }),
  withdrawApplication: (id, token) =>
    request(`/applications/${id}/withdraw`, { method: 'POST', token }),

  // subscriptions
  subConfig: (token) => request('/subscriptions/config', { token }),
  paymentSheet: (token, plan) =>
    request('/subscriptions/payment-sheet', {
      method: 'POST',
      body: plan ? { plan } : undefined,
      token,
    }),
  refreshSub: (token) => request('/subscriptions/refresh', { method: 'POST', token }),
  cancelSub: (token) => request('/subscriptions/cancel', { method: 'POST', token }),
};

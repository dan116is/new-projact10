// Tiny JSON-file backed data store.
// Chosen over a native DB (sqlite) so the server runs anywhere without a build
// toolchain. Not meant for high concurrency — perfect for an MVP / demo.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB location is overridable via DB_FILE (used by tests for isolation).
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const DATA_DIR = path.dirname(DB_FILE);

const EMPTY = {
  users: [], // { id, role, name, email, phone, passwordHash, profile, verified, stripeCustomerId, subscription, createdAt }
  jobs: [], // { id, contractorId, title, trade, description, city, budget, status, createdAt }
  applications: [], // { id, jobId, workerId, message, status, createdAt }
  reviews: [], // { id, jobId, reviewerId, revieweeId, rating, comment, createdAt }
  conversations: [], // { id, participantIds:[a,b], jobId, lastMessageAt, createdAt }
  messages: [], // { id, conversationId, senderId, body, readBy:[], createdAt }
  notifications: [], // { id, userId, type, title, body, data, read, createdAt }
};

let cache = null;

function ensureLoaded() {
  if (cache) return cache;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      // Make sure every collection exists even if the file predates a field.
      cache = { ...structuredClone(EMPTY), ...cache };
    } else {
      cache = structuredClone(EMPTY);
      persist();
    }
  } catch (err) {
    console.error('Failed to load DB, starting fresh:', err.message);
    cache = structuredClone(EMPTY);
  }
  return cache;
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
}

export const db = {
  get data() {
    return ensureLoaded();
  },
  save() {
    persist();
  },
  reset() {
    cache = structuredClone(EMPTY);
    persist();
  },
};

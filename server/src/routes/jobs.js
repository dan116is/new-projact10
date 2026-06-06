// Jobs: contractors post them, workers browse them.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAuth, requireRole, requireSubscription, publicUser, isPro } from '../auth.js';
import { pushNotification } from '../notify.js';

const router = Router();

const JOB_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

// Public-facing job shape, enriched with contractor + application counts.
// Jobs posted by Pro contractors are flagged `promoted` for badge + ranking.
function publicJob(job, { includeContractorContact = false } = {}) {
  const contractor = db.data.users.find((u) => u.id === job.contractorId);
  const applications = db.data.applications.filter((a) => a.jobId === job.id);
  return {
    ...job,
    applicationsCount: applications.length,
    promoted: contractor ? isPro(contractor) : false,
    contractor: contractor
      ? {
          id: contractor.id,
          name: contractor.name,
          company: contractor.profile?.company || null,
          phone: includeContractorContact ? contractor.phone : undefined,
        }
      : null,
  };
}

// Browse open jobs (any authenticated user). Optional ?trade= & ?location= filters.
router.get('/', requireAuth, (req, res) => {
  const { trade, location, status, q, minBudget } = req.query;
  let jobs = db.data.jobs;
  if (status) {
    jobs = jobs.filter((j) => j.status === status);
  } else {
    jobs = jobs.filter((j) => j.status === 'open');
  }
  if (trade) jobs = jobs.filter((j) => j.trade?.toLowerCase() === String(trade).toLowerCase());
  if (location)
    jobs = jobs.filter((j) =>
      j.location?.toLowerCase().includes(String(location).toLowerCase())
    );
  if (q) {
    const needle = String(q).toLowerCase();
    jobs = jobs.filter((j) =>
      [j.title, j.description, j.trade, j.location]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    );
  }
  if (minBudget) {
    const min = Number(minBudget);
    if (!Number.isNaN(min)) jobs = jobs.filter((j) => (j.budget ?? 0) >= min);
  }
  // Promoted (Pro) jobs first, then most recent.
  const cards = jobs
    .map((j) => publicJob(j))
    .sort(
      (a, b) =>
        Number(b.promoted) - Number(a.promoted) || b.createdAt.localeCompare(a.createdAt)
    );
  res.json({ jobs: cards });
});

// Personalised feed for workers: open jobs ranked by how well they match the
// worker's trades + city, then recency.
router.get('/recommended', requireAuth, requireRole('worker'), (req, res) => {
  const trades = (req.user.profile?.trades || []).map((t) => t.toLowerCase());
  const city = (req.user.profile?.city || '').toLowerCase();

  const scored = db.data.jobs
    .filter((j) => j.status === 'open')
    .map((j) => {
      const card = publicJob(j);
      let score = 0;
      if (card.promoted) score += 3; // Pro contractors get promoted placement
      if (trades.includes((j.trade || '').toLowerCase())) score += 2;
      if (city && (j.location || '').toLowerCase().includes(city)) score += 1;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score || b.card.createdAt.localeCompare(a.card.createdAt));

  res.json({ jobs: scored.map((s) => ({ ...s.card, matchScore: s.score })) });
});

// A contractor's own jobs.
router.get('/mine', requireAuth, requireRole('contractor'), (req, res) => {
  const jobs = db.data.jobs
    .filter((j) => j.contractorId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ jobs: jobs.map((j) => publicJob(j)) });
});

router.get('/:id', requireAuth, (req, res) => {
  const job = db.data.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  // Reveal contractor contact to the owner or to workers who were accepted.
  const isOwner = job.contractorId === req.user.id;
  const acceptedHere = db.data.applications.some(
    (a) => a.jobId === job.id && a.workerId === req.user.id && a.status === 'accepted'
  );
  res.json({ job: publicJob(job, { includeContractorContact: isOwner || acceptedHere }) });
});

// Posting a job requires an active subscription (premium contractor feature).
router.post('/', requireAuth, requireRole('contractor'), requireSubscription, (req, res) => {
  const { title, trade, description, location, budget } = req.body || {};
  if (!title || !trade) {
    return res.status(400).json({ error: 'title and trade are required' });
  }
  const job = {
    id: randomUUID(),
    contractorId: req.user.id,
    title: String(title).trim(),
    trade: String(trade).trim(),
    description: description ? String(description).trim() : '',
    location: location ? String(location).trim() : '',
    budget: budget != null ? Number(budget) : null,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.data.jobs.push(job);
  db.save();
  res.status(201).json({ job: publicJob(job, { includeContractorContact: true }) });
});

router.patch('/:id', requireAuth, requireRole('contractor'), (req, res) => {
  const job = db.data.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.contractorId !== req.user.id) {
    return res.status(403).json({ error: 'Not your job' });
  }
  const { title, trade, description, location, budget, status } = req.body || {};
  if (title !== undefined) job.title = String(title).trim();
  if (trade !== undefined) job.trade = String(trade).trim();
  if (description !== undefined) job.description = String(description).trim();
  if (location !== undefined) job.location = String(location).trim();
  if (budget !== undefined) job.budget = budget != null ? Number(budget) : null;
  const prevStatus = job.status;
  if (status !== undefined) {
    if (!JOB_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${JOB_STATUSES.join(', ')}` });
    }
    job.status = status;
  }
  db.save();

  // On completion, prompt both sides to review each other (closes the loop).
  if (status === 'completed' && prevStatus !== 'completed') {
    const accepted = db.data.applications.find(
      (a) => a.jobId === job.id && a.status === 'accepted'
    );
    if (accepted) {
      pushNotification(accepted.workerId, {
        type: 'review',
        title: 'העבודה הושלמה ✓',
        body: `דרגו את ${req.user.name} על "${job.title}"`,
        data: { jobId: job.id, revieweeId: job.contractorId },
      });
      pushNotification(job.contractorId, {
        type: 'review',
        title: 'העבודה הושלמה ✓',
        body: `דרגו את הפועל על "${job.title}"`,
        data: { jobId: job.id, revieweeId: accepted.workerId },
      });
    }
  }
  res.json({ job: publicJob(job, { includeContractorContact: true }) });
});

router.delete('/:id', requireAuth, requireRole('contractor'), (req, res) => {
  const job = db.data.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.contractorId !== req.user.id) {
    return res.status(403).json({ error: 'Not your job' });
  }
  db.data.jobs = db.data.jobs.filter((j) => j.id !== job.id);
  db.data.applications = db.data.applications.filter((a) => a.jobId !== job.id);
  db.save();
  res.json({ ok: true });
});

export default router;

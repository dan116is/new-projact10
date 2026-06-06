// Jobs: contractors post them, workers browse them.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAuth, requireRole, requireSubscription, publicUser } from '../auth.js';

const router = Router();

const JOB_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

// Public-facing job shape, enriched with contractor + application counts.
function publicJob(job, { includeContractorContact = false } = {}) {
  const contractor = db.data.users.find((u) => u.id === job.contractorId);
  const applications = db.data.applications.filter((a) => a.jobId === job.id);
  return {
    ...job,
    applicationsCount: applications.length,
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
  jobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ jobs: jobs.map((j) => publicJob(j)) });
});

// Personalised feed for workers: open jobs ranked by how well they match the
// worker's trades + city, then recency.
router.get('/recommended', requireAuth, requireRole('worker'), (req, res) => {
  const trades = (req.user.profile?.trades || []).map((t) => t.toLowerCase());
  const city = (req.user.profile?.city || '').toLowerCase();

  const scored = db.data.jobs
    .filter((j) => j.status === 'open')
    .map((j) => {
      let score = 0;
      if (trades.includes((j.trade || '').toLowerCase())) score += 2;
      if (city && (j.location || '').toLowerCase().includes(city)) score += 1;
      return { job: j, score };
    })
    .sort((a, b) => b.score - a.score || b.job.createdAt.localeCompare(a.job.createdAt));

  res.json({ jobs: scored.map((s) => ({ ...publicJob(s.job), matchScore: s.score })) });
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
  if (status !== undefined) {
    if (!JOB_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${JOB_STATUSES.join(', ')}` });
    }
    job.status = status;
  }
  db.save();
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

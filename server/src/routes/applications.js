// Applications: workers apply to jobs, contractors accept/reject.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAuth, requireRole, requireSubscription } from '../auth.js';

const router = Router();

const APP_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];

function publicApplication(application) {
  const job = db.data.jobs.find((j) => j.id === application.jobId);
  const worker = db.data.users.find((u) => u.id === application.workerId);
  const contractor = job && db.data.users.find((u) => u.id === job.contractorId);
  // Worker contact is revealed to the contractor only once accepted.
  const revealWorker = application.status === 'accepted';
  return {
    ...application,
    job: job
      ? { id: job.id, title: job.title, trade: job.trade, status: job.status }
      : null,
    worker: worker
      ? {
          id: worker.id,
          name: worker.name,
          trades: worker.profile?.trades || [],
          hourlyRate: worker.profile?.hourlyRate ?? null,
          experienceYears: worker.profile?.experienceYears ?? null,
          phone: revealWorker ? worker.phone : undefined,
        }
      : null,
    contractor: contractor
      ? { id: contractor.id, name: contractor.name, company: contractor.profile?.company || null }
      : null,
  };
}

// Worker applies to a job. Requires an active subscription.
router.post(
  '/jobs/:jobId/apply',
  requireAuth,
  requireRole('worker'),
  requireSubscription,
  (req, res) => {
    const job = db.data.jobs.find((j) => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'open') {
      return res.status(400).json({ error: 'Job is not open for applications' });
    }
    const existing = db.data.applications.find(
      (a) => a.jobId === job.id && a.workerId === req.user.id && a.status !== 'withdrawn'
    );
    if (existing) {
      return res.status(409).json({ error: 'You already applied to this job' });
    }
    const application = {
      id: randomUUID(),
      jobId: job.id,
      workerId: req.user.id,
      message: req.body?.message ? String(req.body.message).trim() : '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.data.applications.push(application);
    db.save();
    res.status(201).json({ application: publicApplication(application) });
  }
);

// A worker's own applications.
router.get('/mine', requireAuth, requireRole('worker'), (req, res) => {
  const apps = db.data.applications
    .filter((a) => a.workerId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ applications: apps.map(publicApplication) });
});

// Applications received on a contractor's job.
router.get('/jobs/:jobId', requireAuth, requireRole('contractor'), (req, res) => {
  const job = db.data.jobs.find((j) => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.contractorId !== req.user.id) {
    return res.status(403).json({ error: 'Not your job' });
  }
  const apps = db.data.applications
    .filter((a) => a.jobId === job.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ applications: apps.map(publicApplication) });
});

// Contractor accepts / rejects an application.
router.patch('/:id', requireAuth, requireRole('contractor'), (req, res) => {
  const application = db.data.applications.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  const job = db.data.jobs.find((j) => j.id === application.jobId);
  if (!job || job.contractorId !== req.user.id) {
    return res.status(403).json({ error: 'Not your job' });
  }
  const { status } = req.body || {};
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted or rejected' });
  }
  application.status = status;
  // Accepting moves the job into progress so it stops accepting new applicants.
  if (status === 'accepted') job.status = 'in_progress';
  db.save();
  res.json({ application: publicApplication(application) });
});

// Worker withdraws their application.
router.post('/:id/withdraw', requireAuth, requireRole('worker'), (req, res) => {
  const application = db.data.applications.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (application.workerId !== req.user.id) {
    return res.status(403).json({ error: 'Not your application' });
  }
  application.status = 'withdrawn';
  db.save();
  res.json({ application: publicApplication(application) });
});

export { APP_STATUSES };
export default router;

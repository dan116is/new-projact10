// Reviews: leave a rating after a completed job, view a user's reviews.
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { pushNotification } from '../notify.js';

const router = Router();

// POST /api/reviews — create a review between two parties who worked together.
router.post('/', requireAuth, (req, res) => {
  const { jobId, revieweeId, rating, comment } = req.body || {};

  if (!jobId || !revieweeId) {
    return res.status(400).json({ error: 'jobId and revieweeId are required' });
  }
  const ratingInt = parseInt(rating, 10);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }

  const reviewerId = req.user.id;
  if (reviewerId === revieweeId) {
    return res.status(400).json({ error: 'Cannot review yourself' });
  }

  const job = db.data.jobs.find((j) => j.id === jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Verify the two parties genuinely worked together on this job.
  // Valid pair: job.contractorId + accepted worker = {reviewerId, revieweeId} in either direction.
  const acceptedApp = db.data.applications.find(
    (a) => a.jobId === jobId && a.status === 'accepted'
  );
  if (!acceptedApp) {
    return res.status(403).json({ error: 'No accepted application exists for this job' });
  }
  const contractorId = job.contractorId;
  const workerId = acceptedApp.workerId;
  const validPair =
    (reviewerId === contractorId && revieweeId === workerId) ||
    (reviewerId === workerId && revieweeId === contractorId);
  if (!validPair) {
    return res.status(403).json({ error: 'You did not work together on this job' });
  }

  // Prevent duplicate reviews for the same (jobId, reviewerId, revieweeId).
  const duplicate = db.data.reviews.find(
    (r) => r.jobId === jobId && r.reviewerId === reviewerId && r.revieweeId === revieweeId
  );
  if (duplicate) {
    return res.status(409).json({ error: 'You already reviewed this person for this job' });
  }

  const review = {
    id: randomUUID(),
    jobId,
    reviewerId,
    revieweeId,
    rating: ratingInt,
    comment: comment ? String(comment).trim() : '',
    createdAt: new Date().toISOString(),
  };
  db.data.reviews.push(review);
  db.save();

  pushNotification(revieweeId, {
    type: 'review',
    title: 'קיבלת ביקורת חדשה',
    body: `דירוג ${ratingInt} כוכבים`,
    data: { jobId },
  });

  res.status(201).json({ review });
});

// GET /api/reviews/user/:userId — all reviews received by a user.
router.get('/user/:userId', requireAuth, (req, res) => {
  const reviews = db.data.reviews
    .filter((r) => r.revieweeId === req.params.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : null;

  const enriched = reviews.map((r) => {
    const reviewer = db.data.users.find((u) => u.id === r.reviewerId);
    return {
      id: r.id,
      jobId: r.jobId,
      reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : { id: r.reviewerId, name: null },
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    };
  });

  res.json({ reviews: enriched, average, count });
});

export default router;

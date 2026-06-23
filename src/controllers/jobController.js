import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import { dateOnly } from '../utils/relativeTime.js';

/**
 * Attach actual applicant counts (real Application records) to a list of jobs:
 * `applicantCount` (total) and `shortlistedCount`. Powers the "Applicants (N)" /
 * "Total Applicants" / "Shortlisted" figures on the manage & admin job views —
 * distinct from the marketing `applications` counter stored on the job.
 */
export async function withApplicantCounts(jobs) {
  if (jobs.length === 0) return [];
  const ids = jobs.map((j) => j.id);
  const counts = await Application.aggregate([
    { $match: { jobId: { $in: ids } } },
    {
      $group: {
        _id: '$jobId',
        total: { $sum: 1 },
        shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
      },
    },
  ]);
  const byId = new Map(counts.map((c) => [c._id, c]));
  return jobs.map((j) => ({
    ...j.toJSON(),
    applicantCount: byId.get(j.id)?.total || 0,
    shortlistedCount: byId.get(j.id)?.shortlisted || 0,
  }));
}

const SORT_MAP = {
  newest: { createdAt: -1 },
  popular: { applications: -1 },
  'salary-high': { 'salary.max': -1 },
};

function buildJobFilter(query) {
  // Public listings: only approved + active jobs (§7.5).
  const filter = { isActive: true, status: 'approved' };
  if (query.type && query.type !== 'All') filter.type = query.type;
  if (query.category && query.category !== 'All') filter.category = query.category;
  if (query.location && query.location !== 'All') {
    filter.location = new RegExp(query.location, 'i');
  }
  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { company: rx }, { skills: rx }, { category: rx }];
  }
  return filter;
}

export const listJobs = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const filter = buildJobFilter(q);
  const sort = SORT_MAP[q.sort] || { createdAt: -1 };

  if (q.paginated) {
    const page = q.page || 1;
    const limit = q.limit || 24;
    const [data, total] = await Promise.all([
      Job.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      Job.countDocuments(filter),
    ]);
    return res.json({ data, total, page, limit });
  }

  const jobs = await Job.find(filter).sort(sort).limit(500);
  res.json(jobs);
});

export const featuredJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ isFeatured: true, isActive: true })
    .sort({ createdAt: -1 })
    .limit(6);
  res.json(jobs);
});

export const internships = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ type: 'Internship', isActive: true }).sort({ createdAt: -1 });
  res.json(jobs);
});

/**
 * All jobs posted by the current user — ANY status (pending/approved/rejected,
 * active or not). Powers the employer ManageJobsView (`/jobs/manage`); the public
 * GET / only returns approved+active and would hide the poster's own listings.
 */
export const myJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ postedBy: req.userId }).sort({ createdAt: -1 });
  res.json(await withApplicantCounts(jobs));
});

export const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  );
  if (!job) throw ApiError.notFound('Job not found');
  res.json(job);
});

export const createJob = asyncHandler(async (req, res) => {
  // Moderation: employer-posted jobs are not public until an admin approves them (§7.5).
  const job = await Job.create({
    ...req.body,
    postedBy: req.userId,
    applications: 0,
    views: 0,
    isActive: false,
    isFeatured: false,
    status: 'pending',
    submittedAt: new Date(),
    rejectionReason: '',
    postedAt: dateOnly(),
  });
  res.status(201).json(job);
});

/** Salary normalization: clamp min to >= 0 and max to >= min. */
export function normalizeSalary(job, salary) {
  if (!salary) return;
  const current = job.salary || {};
  const min = Math.max(0, salary.min ?? current.min ?? 0);
  const max = Math.max(min, salary.max ?? current.max ?? 0);
  job.salary = {
    min,
    max,
    currency: salary.currency || current.currency || 'NGN',
    period: salary.period || current.period || 'monthly',
  };
}

export const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');

  const patch = { ...req.body };
  // Only admins control moderation state; owners may still toggle isActive/isFeatured.
  if (req.user.role !== 'admin') {
    delete patch.status;
    delete patch.rejectionReason;
    delete patch.submittedAt;
  }

  const { salary, ...rest } = patch;
  Object.assign(job, rest);
  normalizeSalary(job, salary);
  await job.save();
  res.json(job);
});

export const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  res.json({ success: true });
});

import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import * as storage from '../services/storageProvider.js';
import { sendApplicationEmail, sendApplicationStatusEmail } from '../services/mailer.js';

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

// Persist an uploaded CV (R2 when configured, else local disk) and return its URL.
function saveCv(req, file) {
  const filename = path.basename(file.path);
  return storage.saveLocalFile({
    filePath: file.path,
    key: storage.keyFor('cvs', filename),
    contentType: file.mimetype,
    baseUrl: baseUrl(req),
  });
}

export const apply = asyncHandler(async (req, res) => {
  const { jobId } = req.body;
  const job = await Job.findById(jobId);
  if (!job) throw ApiError.notFound('Job not found');

  const existing = await Application.findOne({ userId: req.userId, jobId });
  if (existing) throw ApiError.conflict('You have already applied for this job');

  let { cvUrl, cvName } = req.body;
  if (req.file) {
    cvUrl = await saveCv(req, req.file);
    cvName = req.file.originalname;
  }

  let application;
  try {
    application = await Application.create({
      ...req.body,
      userId: req.userId,
      cvUrl: cvUrl || null,
      cvName: cvName || '',
      status: 'pending',
      appliedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('You have already applied for this job');
    throw err;
  }

  await Job.updateOne({ _id: jobId }, { $inc: { applications: 1 } });

  const user = await User.findById(req.userId);
  if (user) sendApplicationEmail(user, job).catch(() => {});

  res.status(201).json(application);
});

export const myApplications = asyncHandler(async (req, res) => {
  const applications = await Application.find({ userId: req.userId }).sort({ appliedAt: -1 });
  const jobIds = applications.map((a) => a.jobId);
  const jobs = await Job.find({ _id: { $in: jobIds } });
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  // Each application + its nested job (powers application tracking).
  const result = applications.map((a) => ({
    ...a.toJSON(),
    job: jobById.get(a.jobId)?.toJSON() || null,
  }));
  res.json(result);
});

export const checkApplied = asyncHandler(async (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId) throw ApiError.badRequest('jobId is required');
  const applied = await Application.exists({ userId: req.userId, jobId });
  res.json({ applied: Boolean(applied) });
});

export const applicationsForJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.jobId).select('postedBy');
  if (!job) throw ApiError.notFound('Job not found');
  if (req.user.role !== 'admin' && String(job.postedBy) !== String(req.userId)) {
    throw ApiError.forbidden('You do not have permission to view these applications');
  }
  const applications = await Application.find({ jobId: req.params.jobId }).sort({ appliedAt: -1 });
  res.json(applications);
});

/**
 * All applications across jobs the current user posted, each merged with its job
 * (powers the employer ManageJobsView / dashboard). Scoped to job.postedBy === me.
 */
export const applicationsForMyJobs = asyncHandler(async (req, res) => {
  const myJobs = await Job.find({ postedBy: req.userId });
  const jobById = new Map(myJobs.map((j) => [j.id, j]));
  const jobIds = myJobs.map((j) => j.id);
  if (jobIds.length === 0) return res.json([]);

  const applications = await Application.find({ jobId: { $in: jobIds } }).sort({ appliedAt: -1 });
  const result = applications.map((a) => ({
    ...a.toJSON(),
    job: jobById.get(a.jobId)?.toJSON() || null,
  }));
  res.json(result);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  const job = await Job.findById(application.jobId).select('postedBy title company');
  if (req.user.role !== 'admin' && String(job?.postedBy) !== String(req.userId)) {
    throw ApiError.forbidden('You do not have permission to update this application');
  }

  const changed = application.status !== req.body.status;
  application.status = req.body.status;
  if (changed) application.reviewedAt = new Date();
  await application.save();

  if (changed && job) {
    sendApplicationStatusEmail(application, job).catch(() => {});
  }
  res.json(application);
});

export const uploadCv = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No CV file uploaded');
  const cvUrl = await saveCv(req, req.file);
  res.status(201).json({ cvUrl, cvName: req.file.originalname });
});

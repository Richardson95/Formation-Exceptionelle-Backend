import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import InstructorApplication from '../models/InstructorApplication.js';
import User from '../models/User.js';
import * as storage from '../services/storageProvider.js';

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

// Persist an uploaded resume (R2 when configured, else local disk) and return its URL.
function saveResume(req, file) {
  const filename = path.basename(file.path);
  return storage.saveLocalFile({
    filePath: file.path,
    key: storage.keyFor('resumes', filename),
    contentType: file.mimetype,
    baseUrl: baseUrl(req),
  });
}

// POST /instructor-applications — a signed-in user applies to teach.
export const apply = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Sign in to apply');
  if (user.role === 'instructor' || user.role === 'admin') {
    throw ApiError.conflict('Your account can already create courses');
  }

  const pending = await InstructorApplication.findOne({ userId: req.userId, status: 'pending' });
  if (pending) throw ApiError.conflict('You already have an application under review');

  let resumeUrl = null;
  let resumeName = '';
  if (req.file) {
    resumeUrl = await saveResume(req, req.file);
    resumeName = req.file.originalname;
  }

  const application = await InstructorApplication.create({
    userId: req.userId,
    fullName: req.body.fullName || `${user.firstName} ${user.lastName}`.trim(),
    email: req.body.email || user.email,
    title: req.body.title,
    experience: req.body.experience || '',
    courseTopic: req.body.courseTopic || '',
    category: req.body.category || '',
    linkedin: req.body.linkedin || '',
    bio: req.body.bio || '',
    motivation: req.body.motivation || '',
    resumeUrl,
    resumeName,
    status: 'pending',
  });

  res.status(201).json(application);
});

// GET /instructor-applications/me — the current user's latest application (for status display).
export const myApplication = asyncHandler(async (req, res) => {
  const application = await InstructorApplication.findOne({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(application || null);
});

// GET /admin/instructor-applications — admin list, optional ?status= filter.
export const listApplications = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const applications = await InstructorApplication.find(filter).sort({ createdAt: -1 });
  res.json(applications);
});

// PATCH /admin/instructor-applications/:id — approve or reject.
export const reviewApplication = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    throw ApiError.badRequest('status must be "approved" or "rejected"');
  }

  const application = await InstructorApplication.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  application.status = status;
  application.rejectionReason = status === 'rejected' ? (reason || '') : '';
  application.reviewedAt = new Date();
  await application.save();

  // On approval, promote the applicant and copy their details onto the profile.
  if (status === 'approved') {
    const user = await User.findById(application.userId);
    if (user) {
      if (user.role === 'participant') user.role = 'instructor';
      user.instructorData = {
        title: application.title,
        experience: application.experience,
        courseTopic: application.courseTopic,
        category: application.category,
        linkedin: application.linkedin,
        bio: application.bio,
      };
      await user.save();
    }
  }

  res.json(application);
});

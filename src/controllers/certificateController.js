import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Certificate from '../models/Certificate.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import { renderCertificatePdf } from '../services/certificatePdf.js';
import { sendCertificateEmail } from '../services/mailer.js';
import User from '../models/User.js';

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

function certificateCode(courseId, userId) {
  return `FE-${String(courseId).toUpperCase()}-${String(userId).slice(-6).toUpperCase()}`;
}

export const generate = asyncHandler(async (req, res) => {
  const { courseId } = req.body;

  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');
  if (!course.certificate) {
    throw ApiError.badRequest('This course does not offer a certificate');
  }

  const progress = await Progress.findOne({ userId: req.userId, courseId });
  if (!progress || progress.percentage < 100) {
    throw ApiError.badRequest('Complete the course to earn your certificate', 'not_complete');
  }

  let certificate = await Certificate.findOne({ userId: req.userId, courseId });
  if (!certificate) {
    certificate = await Certificate.create({
      code: certificateCode(courseId, req.userId),
      userId: req.userId,
      courseId,
      userName: req.user.fullName,
      courseTitle: course.title,
      issuedAt: new Date(),
    });
  }

  if (!certificate.pdfUrl) {
    certificate.pdfUrl = await renderCertificatePdf({ certificate, baseUrl: baseUrl(req) });
    await certificate.save();
    const user = await User.findById(req.userId);
    if (user) sendCertificateEmail(user, certificate).catch(() => {});
  }

  res.status(201).json(certificate);
});

export const myCertificates = asyncHandler(async (req, res) => {
  const certs = await Certificate.find({ userId: req.userId }).sort({ issuedAt: -1 });
  res.json(certs);
});

export const getCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Accept either the db id or the display code.
  const cert =
    (await Certificate.findOne({ code: id })) ||
    (await Certificate.findById(id).catch(() => null));
  if (!cert) throw ApiError.notFound('Certificate not found');
  res.json({
    id: cert.id,
    code: cert.code,
    userName: cert.userName,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt,
    pdfUrl: cert.pdfUrl,
    valid: true,
  });
});

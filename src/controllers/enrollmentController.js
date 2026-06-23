import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Progress from '../models/Progress.js';
import { enrollUserInCourse } from '../services/enrollmentService.js';

export const enroll = asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');

  // Paid courses must go through payment (§9).
  if ((course.price || 0) > 0) {
    throw ApiError.badRequest('This is a paid course — please complete checkout to enroll', 'payment_required');
  }

  const { enrollment } = await enrollUserInCourse(req.userId, courseId);
  res.status(201).json({ success: true, enrollment });
});

export const myEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.userId }).sort({ enrolledAt: -1 });
  const courseIds = enrollments.map((e) => e.courseId);

  const [courses, progresses] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }),
    Progress.find({ userId: req.userId, courseId: { $in: courseIds } }),
  ]);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const progressById = new Map(progresses.map((p) => [p.courseId, p]));

  // Each item: full course + progress + enrolledAt (StudentDashboard shape).
  const result = enrollments
    .map((e) => {
      const course = courseById.get(e.courseId);
      if (!course) return null;
      const progress = progressById.get(e.courseId);
      return {
        ...course.toJSON(),
        enrolledAt: e.enrolledAt,
        progress: progress
          ? {
              completedLectures: progress.completedLectures,
              percentage: progress.percentage,
              completedAt: progress.completedAt,
            }
          : { completedLectures: [], percentage: 0, completedAt: null },
      };
    })
    .filter(Boolean);

  res.json(result);
});

export const checkEnrollment = asyncHandler(async (req, res) => {
  const courseId = req.query.courseId;
  if (!courseId) throw ApiError.badRequest('courseId is required');
  const enrolled = await Enrollment.exists({ userId: req.userId, courseId });
  res.json({ enrolled: Boolean(enrolled) });
});

import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import Enrollment from '../models/Enrollment.js';

function totalLectures(course) {
  return (course.sections || []).reduce((sum, s) => sum + (s.lectures?.length || 0), 0);
}

export const getProgress = asyncHandler(async (req, res) => {
  const courseId = req.query.courseId;
  if (!courseId) throw ApiError.badRequest('courseId is required');
  const progress = await Progress.findOne({ userId: req.userId, courseId });
  res.json(
    progress
      ? {
          completedLectures: progress.completedLectures,
          percentage: progress.percentage,
          completedAt: progress.completedAt,
        }
      : { completedLectures: [], percentage: 0, completedAt: null }
  );
});

export const completeLecture = asyncHandler(async (req, res) => {
  const { courseId, lectureId } = req.body;

  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');

  const enrolled = await Enrollment.exists({ userId: req.userId, courseId });
  if (!enrolled) throw ApiError.forbidden('You are not enrolled in this course');

  let progress = await Progress.findOne({ userId: req.userId, courseId });
  if (!progress) {
    progress = new Progress({ userId: req.userId, courseId, completedLectures: [] });
  }

  if (!progress.completedLectures.includes(lectureId)) {
    progress.completedLectures.push(lectureId);
  }

  const total = totalLectures(course) || 1;
  progress.percentage = Math.min(
    100,
    Math.round((progress.completedLectures.length / total) * 100)
  );
  progress.completedAt = progress.percentage >= 100 ? progress.completedAt || new Date() : null;

  await progress.save();

  res.json({
    completedLectures: progress.completedLectures,
    percentage: progress.percentage,
    completedAt: progress.completedAt,
  });
});

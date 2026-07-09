import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Course from '../models/Course.js';
import Review from '../models/Review.js';
import Enrollment from '../models/Enrollment.js';
import Progress from '../models/Progress.js';
import { dateOnly } from '../utils/relativeTime.js';

export const SORT_MAP = {
  popular: { enrolledCount: -1 },
  rating: { rating: -1 },
  newest: { createdAt: -1 },
  'price-low': { price: 1 },
  'price-high': { price: -1 },
};

export function buildCourseFilter(query, { admin = false } = {}) {
  const filter = {};
  // Public listings ALWAYS force published; only admin may filter by other statuses.
  if (admin) {
    if (query.status) filter.status = query.status;
  } else {
    filter.status = 'published';
  }

  if (query.category && query.category !== 'All') filter.category = query.category;
  if (query.level && query.level !== 'All') filter.level = query.level;

  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { tags: rx }, { category: rx }];
  }
  return filter;
}

export const listCourses = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const filter = buildCourseFilter(q);
  const sort = SORT_MAP[q.sort] || { createdAt: -1 };

  const page = q.page || 1;
  const limit = q.limit || 24;

  if (q.paginated) {
    const [data, total] = await Promise.all([
      Course.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      Course.countDocuments(filter),
    ]);
    return res.json({ data, total, page, limit });
  }

  // Default: plain array (drop-in compatible with the frontend store).
  const courses = await Course.find(filter).sort(sort).limit(500);
  res.json(courses);
});

export const featuredCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ featured: true, status: 'published' })
    .sort({ enrolledCount: -1 })
    .limit(12);
  res.json(courses);
});

// Unapproved courses are visible only to the instructor who owns them and to admins.
function canSeeUnpublished(req, instructorId) {
  if (!req.user) return false;
  return req.user.role === 'admin' || String(req.userId) === String(instructorId);
}

/**
 * The `instructor.rating` / `instructor.students` fields on a course are written
 * once at creation and never maintained, so they would report 0 forever. Derive
 * them from the instructor's real reviews and enrollments across all of their
 * courses. Students are counted distinctly — one learner on three of an
 * instructor's courses is one student, not three.
 */
async function instructorStats(instructorId) {
  const courseIds = (await Course.find({ instructorId }).select('_id')).map((c) => c.id);
  if (courseIds.length === 0) return { rating: 0, students: 0 };

  const [agg, students] = await Promise.all([
    Review.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]),
    Enrollment.distinct('userId', { courseId: { $in: courseIds } }),
  ]);

  return {
    rating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
    students: students.length,
  };
}

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  if (course.status !== 'published' && !canSeeUnpublished(req, course.instructorId)) {
    throw ApiError.notFound('Course not found');
  }

  const json = course.toJSON();
  json.instructor = { ...json.instructor, ...(await instructorStats(course.instructorId)) };
  res.json(json);
});

export const instructorCourses = asyncHandler(async (req, res) => {
  const { instructorId } = req.params;
  const filter = {
    $or: [{ instructorId }, { 'instructor.id': instructorId }],
  };
  if (!canSeeUnpublished(req, instructorId)) filter.status = 'published';

  const courses = await Course.find(filter).sort({ createdAt: -1 });
  res.json(courses);
});

export const createCourse = asyncHandler(async (req, res) => {
  const user = req.user;
  const data = req.body;

  // Moderation: "Save Draft" keeps it private as 'draft'; otherwise the course is
  // submitted for admin review as 'pending'. It is NOT public until approved (§7.10).
  const isDraft = data.status === 'draft';
  const status = isDraft ? 'draft' : 'pending';

  const course = await Course.create({
    ...data,
    instructorId: user.id,
    instructor: {
      id: user.id,
      name: user.fullName,
      avatar: user.avatar || null,
      rating: 0,
      students: 0,
    },
    rating: 0,
    reviewCount: 0,
    enrolledCount: 0,
    featured: false, // only an admin can feature a course
    status,
    submittedAt: status === 'pending' ? new Date() : null,
    rejectionReason: '',
    lastUpdated: dateOnly(),
  });

  res.status(201).json(course);
});

/**
 * Server-authoritative pricing normalization (§7.10): clamp negatives, force
 * free courses to 0, and keep originalPrice >= price.
 */
export function normalizePricing(target, patch) {
  if (patch.isPaid !== undefined) target.isPaid = patch.isPaid;
  if (patch.price !== undefined) target.price = Math.max(0, patch.price);
  if (patch.originalPrice !== undefined) target.originalPrice = Math.max(0, patch.originalPrice);

  if (target.isPaid === false) {
    target.price = 0;
    target.originalPrice = 0;
  }
  if ((target.originalPrice || 0) < (target.price || 0)) {
    target.originalPrice = target.price;
  }
}

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');

  const patch = { ...req.body };
  // Only admins control moderation/feature state; strip those from instructor edits.
  if (req.user.role !== 'admin') {
    delete patch.status;
    delete patch.featured;
    delete patch.rejectionReason;
    delete patch.submittedAt;
  }

  const { price, originalPrice, isPaid, ...rest } = patch;
  Object.assign(course, rest);
  normalizePricing(course, { price, originalPrice, isPaid });
  course.lastUpdated = dateOnly();
  await course.save();
  res.json(course);
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  res.json({ success: true });
});

export const listReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ courseId: req.params.id }).sort({ createdAt: -1 });
  res.json(reviews);
});

export const createReview = asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');

  const enrolled = await Enrollment.findOne({ userId: req.userId, courseId });
  if (!enrolled) throw ApiError.forbidden('You must be enrolled to review this course');

  const existing = await Review.findOne({ userId: req.userId, courseId });
  if (existing) throw ApiError.conflict('You have already reviewed this course');

  const review = await Review.create({
    userId: req.userId,
    courseId,
    userName: req.user.fullName,
    rating: req.body.rating,
    comment: req.body.comment,
  });

  // Recompute course rating + reviewCount.
  const agg = await Review.aggregate([
    { $match: { courseId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (agg[0]) {
    course.rating = Math.round(agg[0].avg * 10) / 10;
    course.reviewCount = agg[0].count;
    await course.save();
  }

  res.status(201).json(review);
});

import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import User from '../models/User.js';

/**
 * Idempotently enroll a user in a course. Returns { enrollment, created }.
 * Increments course.enrolledCount and updates the user's enrolledCourses only
 * when a new enrollment is actually created.
 */
export async function enrollUserInCourse(userId, courseId) {
  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) return { enrollment: existing, created: false };

  let enrollment;
  try {
    enrollment = await Enrollment.create({ userId, courseId });
  } catch (err) {
    // Race on the unique compound index — treat as already enrolled.
    if (err.code === 11000) {
      const found = await Enrollment.findOne({ userId, courseId });
      return { enrollment: found, created: false };
    }
    throw err;
  }

  await Promise.all([
    Course.updateOne({ _id: courseId }, { $inc: { enrolledCount: 1 } }),
    User.updateOne({ _id: userId }, { $addToSet: { enrolledCourses: courseId } }),
  ]);

  return { enrollment, created: true };
}

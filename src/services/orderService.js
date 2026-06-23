import Course from '../models/Course.js';
import User from '../models/User.js';
import Enrollment from '../models/Enrollment.js';
import { enrollUserInCourse } from './enrollmentService.js';
import { sendEnrollmentEmail } from './mailer.js';

/**
 * Fulfill a paid order: mark paid, enroll the user in each item (idempotent),
 * bump enrolledCount (handled inside enrollUserInCourse), and email a receipt.
 * Safe to call multiple times — won't double-fulfill an already-paid order.
 */
export async function fulfillOrder(order) {
  if (order.status === 'paid') return order;
  order.status = 'paid';
  order.paidAt = order.paidAt || new Date();
  await order.save();

  for (const item of order.items) {
    await enrollUserInCourse(order.userId, item.courseId);
  }

  const user = await User.findById(order.userId);
  if (user) sendEnrollmentEmail(user, order.items).catch(() => {});
  return order;
}

/**
 * Refund an order: mark refunded and revoke the enrollments it created.
 * Decrements course enrolledCount for each revoked enrollment.
 */
export async function refundOrder(order) {
  if (order.status === 'refunded') return order;
  const wasPaid = order.status === 'paid';
  order.status = 'refunded';
  await order.save();

  if (wasPaid) {
    for (const item of order.items) {
      const deleted = await Enrollment.findOneAndDelete({
        userId: order.userId,
        courseId: item.courseId,
      });
      if (deleted) {
        await Course.updateOne({ _id: item.courseId }, { $inc: { enrolledCount: -1 } });
        await User.updateOne({ _id: order.userId }, { $pull: { enrolledCourses: item.courseId } });
      }
    }
  }
  return order;
}

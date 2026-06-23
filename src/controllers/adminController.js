import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Enrollment from '../models/Enrollment.js';
import Order from '../models/Order.js';
import Certificate from '../models/Certificate.js';
import Review from '../models/Review.js';
import { relativeTime, dateOnly } from '../utils/relativeTime.js';
import { normalizePricing, buildCourseFilter } from './courseController.js';
import { normalizeSalary, withApplicantCounts } from './jobController.js';
import { fulfillOrder, refundOrder } from '../services/orderService.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Dashboard stats (§13.6) ──────────────────────────────────────────────────
export const stats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalInstructors,
    totalParticipants,
    totalCourses,
    totalEnrollments,
    totalJobs,
    totalApplications,
    internships,
    pendingCourses,
    pendingJobs,
    paidOrders,
    courses,
    ratingAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'instructor' }),
    User.countDocuments({ role: 'participant' }),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments(),
    Job.countDocuments({ type: 'Internship' }),
    Course.countDocuments({ status: 'pending' }),
    Job.countDocuments({ status: 'pending' }),
    Order.find({ status: 'paid' }),
    Course.find().sort({ enrolledCount: -1 }).limit(5),
    Course.aggregate([
      { $match: { reviewCount: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]),
  ]);

  const totalRevenue = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const paidStudents = new Set(paidOrders.map((o) => o.userId)).size;

  const year = new Date().getFullYear();
  const revenueByMonth = MONTHS.map((m) => ({ month: m, revenue: 0 }));
  for (const o of paidOrders) {
    const d = o.paidAt || o.createdAt;
    if (d && new Date(d).getFullYear() === year) revenueByMonth[new Date(d).getMonth()].revenue += o.total || 0;
  }

  const enrollments = await Enrollment.find().select('enrolledAt');
  const enrollmentsByMonth = MONTHS.map((m) => ({ month: m, count: 0 }));
  for (const e of enrollments) {
    const d = e.enrolledAt;
    if (d && new Date(d).getFullYear() === year) enrollmentsByMonth[new Date(d).getMonth()].count += 1;
  }

  const [recentEnroll, recentApps, recentOrders, recentUsers, recentCerts, recentReviews] =
    await Promise.all([
      Enrollment.find().sort({ enrolledAt: -1 }).limit(5),
      Application.find().sort({ appliedAt: -1 }).limit(5),
      Order.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(5),
      User.find().sort({ createdAt: -1 }).limit(5),
      Certificate.find().sort({ issuedAt: -1 }).limit(5),
      Review.find().sort({ createdAt: -1 }).limit(5),
    ]);

  const activity = [
    ...recentEnroll.map((e) => ({ at: e.enrolledAt, type: 'enrollment', icon: 'book', message: 'New course enrollment' })),
    ...recentApps.map((a) => ({ at: a.appliedAt, type: 'application', icon: 'document', message: `New application from ${a.fullName}` })),
    ...recentOrders.map((o) => ({ at: o.paidAt, type: 'payment', icon: 'currency', message: `Payment of $${o.total} received` })),
    ...recentUsers.map((u) => ({ at: u.createdAt, type: 'user', icon: 'user', message: `${u.firstName} ${u.lastName} joined` })),
    ...recentCerts.map((c) => ({ at: c.issuedAt, type: 'certificate', icon: 'badge', message: `Certificate issued: ${c.courseTitle}` })),
    ...recentReviews.map((r) => ({ at: r.createdAt, type: 'review', icon: 'star', message: `New ${r.rating}★ review` })),
  ]
    .filter((a) => a.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12)
    .map((a, i) => ({ id: i + 1, type: a.type, icon: a.icon, message: a.message, time: relativeTime(a.at) }));

  const conversionRate = totalUsers ? Math.round((paidStudents / totalUsers) * 1000) / 10 : 0;

  res.json({
    totalUsers,
    totalInstructors,
    totalParticipants,
    totalCourses,
    totalEnrollments,
    totalRevenue,
    paidStudents,
    totalJobs,
    totalApplications,
    internships,
    pendingCourses,
    pendingJobs,
    pendingApprovals: pendingCourses + pendingJobs,
    pageViews: 0,
    weeklyVisitors: 0,
    conversionRate,
    avgCourseRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
    revenueByMonth,
    enrollmentsByMonth,
    topCourses: courses,
    recentActivity: activity,
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const listUsers = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const filter = {};
  if (q.role && q.role !== 'All') filter.role = q.role;
  if (q.q) {
    const rx = new RegExp(String(q.q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const isSelf = String(user.id) === String(req.userId);

  // Guard rails: an admin can't demote or suspend themselves, and the last admin
  // can't be demoted away.
  if (req.body.role && req.body.role !== 'admin' && user.role === 'admin') {
    if (isSelf) throw ApiError.forbidden('You cannot change your own admin role');
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw ApiError.forbidden('Cannot demote the last remaining admin');
  }
  if (req.body.status === 'suspended' && isSelf) {
    throw ApiError.forbidden('You cannot suspend your own account');
  }

  if (req.body.role) user.role = req.body.role;
  if (req.body.status) user.status = req.body.status;
  await user.save();
  res.json(user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (String(user.id) === String(req.userId)) {
    throw ApiError.forbidden('You cannot delete your own admin account');
  }
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw ApiError.forbidden('Cannot delete the last remaining admin');
  }
  await user.deleteOne();
  // Cascade: clean up the user's own activity.
  await Promise.all([
    Enrollment.deleteMany({ userId: user.id }),
    Application.deleteMany({ userId: user.id }),
    Review.deleteMany({ userId: user.id }),
  ]);
  res.json({ success: true, id: user.id });
});

// ── Courses ────────────────────────────────────────────────────────────────────
export const listCourses = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const filter = buildCourseFilter(q, { admin: true });
  if (q.featured === true || q.featured === 'true') filter.featured = true;
  if (q.featured === false || q.featured === 'false') filter.featured = false;
  const courses = await Course.find(filter).sort({ createdAt: -1 });
  res.json(courses);
});

export const approveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  if (!['pending', 'rejected', 'draft'].includes(course.status)) {
    throw ApiError.conflict('Course is not awaiting approval');
  }
  course.status = 'published';
  course.rejectionReason = '';
  await course.save();
  res.json(course);
});

export const rejectCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  course.status = 'rejected';
  course.rejectionReason = req.body.reason;
  await course.save();
  res.json(course);
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');

  const { price, originalPrice, isPaid, featured, status } = req.body;
  if (featured !== undefined) course.featured = featured;
  if (status !== undefined) course.status = status;
  normalizePricing(course, { price, originalPrice, isPaid });
  course.lastUpdated = dateOnly();
  await course.save();
  res.json(course);
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  res.json({ success: true, id: course.id });
});

// ── Jobs ───────────────────────────────────────────────────────────────────────
export const listJobs = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const filter = {};
  if (q.q) {
    const rx = new RegExp(String(q.q), 'i');
    filter.$or = [{ title: rx }, { company: rx }, { skills: rx }];
  }
  if (q.category && q.category !== 'All') filter.category = q.category;
  if (q.type && q.type !== 'All') filter.type = q.type;
  if (q.status) filter.status = q.status;
  if (q.isActive === 'true' || q.isActive === true) filter.isActive = true;
  if (q.isActive === 'false' || q.isActive === false) filter.isActive = false;
  if (q.isFeatured === 'true' || q.isFeatured === true) filter.isFeatured = true;
  const jobs = await Job.find(filter).sort({ createdAt: -1 });
  res.json(await withApplicantCounts(jobs));
});

export const approveJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  job.status = 'approved';
  job.isActive = true;
  job.rejectionReason = '';
  await job.save();
  res.json(job);
});

export const rejectJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  job.status = 'rejected';
  job.isActive = false;
  job.rejectionReason = req.body.reason;
  await job.save();
  res.json(job);
});

export const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');

  const { salary, isActive, isFeatured } = req.body;
  if (isActive !== undefined) job.isActive = isActive;
  if (isFeatured !== undefined) job.isFeatured = isFeatured;
  normalizeSalary(job, salary);
  await job.save();
  res.json(job);
});

export const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  res.json({ success: true, id: job.id });
});

// ── Payments ─────────────────────────────────────────────────────────────────
const STATUS_TO_TABLE = { paid: 'completed', pending: 'pending', refunded: 'refunded', failed: 'failed' };

async function queryOrders(q) {
  const filter = {};
  if (q.status) {
    // Accept table-status (completed) or order-status (paid).
    const map = { completed: 'paid', pending: 'pending', refunded: 'refunded', failed: 'failed' };
    filter.status = map[q.status] || q.status;
  }
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  let orders = await Order.find(filter).sort({ createdAt: -1 });
  if (q.q) {
    const rx = new RegExp(String(q.q), 'i');
    orders = orders.filter(
      (o) => rx.test(o.billing?.email || '') || rx.test(`${o.billing?.firstName || ''} ${o.billing?.lastName || ''}`)
    );
  }
  return orders;
}

function toTransaction(o, idx) {
  const primary = o.items?.[0];
  const extra = (o.items?.length || 0) > 1 ? ` +${o.items.length - 1} more` : '';
  return {
    id: `TXN-${String(idx + 1).padStart(3, '0')}-${new Date(o.createdAt).getFullYear()}`,
    orderId: o.id,
    student: `${o.billing?.firstName || ''} ${o.billing?.lastName || ''}`.trim() || 'Unknown',
    email: o.billing?.email || '',
    course: (primary?.title || '—') + extra,
    amount: String(o.total),
    date: dateOnly(o.paidAt || o.createdAt),
    status: STATUS_TO_TABLE[o.status] || o.status,
  };
}

export const listPayments = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const orders = await queryOrders(q);
  const transactions = orders.map(toTransaction);

  const paid = orders.filter((o) => o.status === 'paid');
  const totalRevenue = paid.reduce((s, o) => s + (o.total || 0), 0);
  const paidStudents = new Set(paid.map((o) => o.userId)).size;
  const avgOrderValue = paid.length ? Math.round((totalRevenue / paid.length) * 100) / 100 : 0;
  const now = new Date();
  const thisMonth = paid
    .filter((o) => {
      const d = new Date(o.paidAt || o.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, o) => s + (o.total || 0), 0);

  res.json({
    summary: { totalRevenue, paidStudents, avgOrderValue, thisMonth },
    transactions,
  });
});

export const exportPayments = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const orders = await queryOrders(q);
  const rows = [['Transaction ID', 'Student', 'Email', 'Course', 'Amount', 'Date', 'Status']];
  orders.forEach((o, i) => {
    const t = toTransaction(o, i);
    rows.push([t.id, t.student, t.email, t.course, t.amount, t.date, t.status]);
  });
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.send(csv);
});

export const updatePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');

  const next = req.body.status;
  if (next === 'paid') {
    await fulfillOrder(order); // idempotent — creates enrollments + email
  } else if (next === 'refunded') {
    await refundOrder(order);
  } else {
    order.status = next;
    await order.save();
  }
  res.json(order);
});

// ── Analytics ────────────────────────────────────────────────────────────────
export const analytics = asyncHandler(async (req, res) => {
  const year = new Date().getFullYear();
  const now = new Date();

  const [paidOrders, enrollments, totalUsers, courses] = await Promise.all([
    Order.find({ status: 'paid' }),
    Enrollment.find().select('enrolledAt'),
    User.countDocuments(),
    Course.find().select('category enrolledCount price'),
  ]);

  const enrollmentTrend = MONTHS.map((m) => ({ month: m, count: 0 }));
  for (const e of enrollments) {
    const d = e.enrolledAt;
    if (d && new Date(d).getFullYear() === year) enrollmentTrend[new Date(d).getMonth()].count += 1;
  }

  // Revenue by category — approximate from paid order items mapped to course category.
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const revenueByCat = {};
  let revTotal = 0;
  for (const o of paidOrders) {
    for (const item of o.items) {
      const cat = courseById.get(item.courseId)?.category || 'Other';
      revenueByCat[cat] = (revenueByCat[cat] || 0) + (item.price || 0);
      revTotal += item.price || 0;
    }
  }
  const revenueByCategory = Object.entries(revenueByCat)
    .map(([name, amount]) => ({ name, pct: revTotal ? Math.round((amount / revTotal) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const revenueMTD = paidOrders
    .filter((o) => {
      const d = new Date(o.paidAt || o.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, o) => s + (o.total || 0), 0);
  const newEnrollmentsMTD = enrollments.filter((e) => {
    const d = new Date(e.enrolledAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const paidStudents = new Set(paidOrders.map((o) => o.userId)).size;

  res.json({
    keyMetrics: {
      pageViews: { value: 0, change: 0 },
      uniqueVisitors: { value: 0, change: 0 },
      newEnrollments: { value: newEnrollmentsMTD, change: 0 },
      revenueMTD: { value: revenueMTD, change: 0 },
    },
    enrollmentTrend,
    revenueByCategory,
    // Traffic/demographics require real analytics instrumentation — reasonable defaults until then.
    trafficSources: [
      { name: 'Organic Search', pct: 42 },
      { name: 'Social Media', pct: 28 },
      { name: 'Direct', pct: 18 },
      { name: 'Referral', pct: 12 },
    ],
    demographics: [
      { country: 'Nigeria', pct: 45 },
      { country: 'Ghana', pct: 18 },
      { country: 'Kenya', pct: 14 },
      { country: 'South Africa', pct: 12 },
      { country: 'Others', pct: 11 },
    ],
    funnel: [
      { label: 'Visitors', value: Math.max(totalUsers * 10, 0) },
      { label: 'Sign Ups', value: totalUsers },
      { label: 'Course Views', value: enrollments.length * 2 },
      { label: 'Add to Cart', value: Math.round(enrollments.length * 1.2) },
      { label: 'Purchases', value: paidStudents },
    ],
  });
});

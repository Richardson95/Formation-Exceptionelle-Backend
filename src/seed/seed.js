import mongoose from 'mongoose';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Job from '../models/Job.js';
import Quiz from '../models/Quiz.js';
import Order from '../models/Order.js';
import { DEMO_COURSES } from './courses.js';
import { DEMO_JOBS } from './jobs.js';
import { DEMO_ORDERS } from './orders.js';

async function ensureAdmin() {
  let admin = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (admin) {
    console.log(`[seed] Admin already exists: ${admin.email}`);
    return admin;
  }
  admin = await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
    bio: 'Platform Administrator',
  });
  console.log(`[seed] Created admin: ${admin.email}`);
  return admin;
}

async function ensureInstructor() {
  let instructor = await User.findOne({ email: 'instructor@formationexceptionelle.com' });
  if (!instructor) {
    instructor = await User.create({
      firstName: 'Adaeze',
      lastName: 'Okafor',
      email: 'instructor@formationexceptionelle.com',
      password: 'Instructor@2024!',
      role: 'instructor',
      bio: 'Senior Advocate with 20+ years advising on mergers, acquisitions, deal financing and complex commercial dispute resolution.',
      profession: 'Lead Faculty, Corporate Transactions',
      instructorData: {
        title: 'Senior Advocate of Nigeria (SAN)',
        experience: '10+ years',
        courseTopic: 'M&A, Financing & ADR',
        category: 'Dispute Resolution',
        linkedin: 'https://linkedin.com/in/adaeze-okafor',
        bio: 'Lead faculty for corporate transactions and dispute resolution.',
      },
    });
    console.log(`[seed] Created demo instructor: ${instructor.email}`);
  }
  return instructor;
}

async function seedCourses() {
  const count = await Course.countDocuments();
  if (count > 0) {
    console.log(`[seed] Courses already present (${count}) — skipping.`);
    return;
  }
  // Courses carry their own denormalized instructor + instructorId (see courses.js).
  for (const data of DEMO_COURSES) {
    await Course.create(data);
  }
  console.log(`[seed] Inserted ${DEMO_COURSES.length} demo courses.`);

  // A sample quiz wired to c001's quiz lecture (QuizComponent parity, 70% pass).
  await Quiz.create({
    courseId: 'c001',
    lectureId: 'l3',
    title: 'Corporate Practice Knowledge Check',
    passMark: 70,
    questions: [
      { question: 'In an M&A transaction, "due diligence" primarily serves to:', options: ['Set the marketing budget', 'Identify legal, financial and commercial risks before closing', 'Register the new company name', 'Draft the press release'], correct: 1 },
      { question: 'Alternative Dispute Resolution (ADR) typically includes:', options: ['Litigation only', 'Arbitration and mediation', 'Criminal prosecution', 'Tax filing'], correct: 1 },
      { question: 'A company secretary is chiefly responsible for:', options: ['Product pricing', 'Statutory compliance and board administration', 'Software development', 'Advertising campaigns'], correct: 1 },
    ],
  });
  console.log('[seed] Inserted sample quiz for c001/l3.');
}

async function seedJobs(admin) {
  const count = await Job.countDocuments();
  if (count > 0) {
    console.log(`[seed] Jobs already present (${count}) — skipping.`);
    return;
  }
  for (const data of DEMO_JOBS) {
    await Job.create({ ...data, postedBy: admin.id });
  }
  console.log(`[seed] Inserted ${DEMO_JOBS.length} demo jobs.`);
}

async function seedOrders() {
  const count = await Order.countDocuments();
  if (count > 0) {
    console.log(`[seed] Orders already present (${count}) — skipping.`);
    return;
  }
  for (const data of DEMO_ORDERS) {
    const when = new Date(`${data.date}T12:00:00.000Z`);
    const subtotal = data.items.reduce((s, i) => s + (i.price || 0), 0);
    // Set createdAt explicitly (newest = TXN-001 in the admin table). createdAt is
    // immutable after insert, so we set it on a new doc and save with timestamps off.
    const order = new Order({
      userId: data.userId,
      items: data.items,
      subtotal,
      savings: 0,
      total: data.total,
      currency: 'NGN',
      paymentMethod: 'card',
      paymentProvider: 'demo',
      providerReference: `demo-${data.userId}`,
      billing: data.billing,
      status: data.status,
      paidAt: data.status === 'paid' || data.status === 'refunded' ? when : null,
      createdAt: when,
      updatedAt: when,
    });
    await order.save({ timestamps: false });
  }
  console.log(`[seed] Inserted ${DEMO_ORDERS.length} demo orders.`);
}

async function run() {
  await connectDB();
  const admin = await ensureAdmin();
  await ensureInstructor();
  await seedCourses();
  await seedJobs(admin);
  await seedOrders();
  console.log('[seed] Done.');
  await disconnectDB();
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});

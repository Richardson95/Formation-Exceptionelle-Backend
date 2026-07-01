// End-to-end smoke test against an in-memory MongoDB.
// Boots the real Express app, seeds, and exercises the core flows over HTTP.
import { MongoMemoryServer } from 'mongodb-memory-server';

let pass = 0;
let fail = 0;
const results = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; results.push(`  ✓ ${name}`); }
  else { fail++; results.push(`  ✗ ${name} ${extra}`); }
}

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('formation_exceptionelle');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.PORT = '5099';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
await connectDB(process.env.MONGODB_URI);

const { default: User } = await import('../src/models/User.js');
const { default: Course } = await import('../src/models/Course.js');
const { default: Job } = await import('../src/models/Job.js');
const { DEMO_COURSES } = await import('../src/seed/courses.js');
const { DEMO_JOBS } = await import('../src/seed/jobs.js');

const admin = await User.create({ firstName: 'Admin', lastName: 'User', email: 'admin@formationexceptionelle.com', password: 'Admin@2024!', role: 'admin' });
const instructor = await User.create({ firstName: 'Adaeze', lastName: 'Okafor', email: 'instructor@fe.com', password: 'Instructor@2024!', role: 'instructor' });
for (const c of DEMO_COURSES) await Course.create({ ...c, instructorId: instructor.id, instructor: { id: instructor.id, name: instructor.fullName, avatar: null, rating: 4.8, students: 100 } });
for (const j of DEMO_JOBS) await Job.create({ ...j, postedBy: admin.id });
// A free published course to exercise free enrollment (seeded catalog is all paid).
await Course.create({ _id: 'cfree', title: 'Intro to Corporate Practice (Free)', subtitle: 'Free primer', description: 'Free', category: 'Corporate Law', price: 0, originalPrice: 0, isPaid: false, status: 'published', instructorId: instructor.id, instructor: { id: instructor.id, name: instructor.fullName, avatar: null, rating: 0, students: 0 }, sections: [{ id: 's1', title: 'Intro', duration: '10m', lectures: [{ id: 'l1', title: 'Welcome', duration: '5:00', type: 'video', preview: true, videoUrl: 'x' }] }] });

const { createApp } = await import('../src/server.js');
const app = createApp();
const server = app.listen(5099);
const BASE = 'http://localhost:5099/api';

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  let text = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) { try { json = await res.json(); } catch { /**/ } }
  else { text = await res.text(); }
  return { status: res.status, json, text };
}

try {
  // Health
  const health = await fetch('http://localhost:5099/api/health').then((r) => r.json());
  check('health check', health.status === 'ok');

  // Register
  const reg = await req('POST', '/auth/register', { body: { firstName: 'Sam', lastName: 'Test', email: 'sam@test.com', password: 'Password123' } });
  check('register returns user+token', reg.status === 201 && reg.json.token && reg.json.user.id, JSON.stringify(reg.json));
  check('register strips password', reg.json.user && reg.json.user.password === undefined);
  check('register forces participant role', reg.json.user?.role === 'participant');
  const userToken = reg.json.token;

  const dup = await req('POST', '/auth/register', { body: { firstName: 'Sam', lastName: 'Two', email: 'sam@test.com', password: 'Password123' } });
  check('duplicate email -> 409 exact message', dup.status === 409 && dup.json.error.message === 'An account with this email already exists');

  const badLogin = await req('POST', '/auth/login', { body: { email: 'sam@test.com', password: 'wrong' } });
  check('bad login -> Invalid email or password', badLogin.status === 401 && badLogin.json.error.message === 'Invalid email or password');

  const adminLogin = await req('POST', '/auth/login', { body: { email: 'admin@formationexceptionelle.com', password: 'Admin@2024!' } });
  check('admin login ok', adminLogin.status === 200 && adminLogin.json.user.role === 'admin');
  const adminToken = adminLogin.json.token;

  const me = await req('GET', '/auth/me', { token: userToken });
  check('GET /auth/me', me.status === 200 && me.json.user.email === 'sam@test.com');

  // Courses — public list returns only published (9 seeded + cfree = 10)
  const courses = await req('GET', '/courses');
  check('GET /courses returns array (published only)', Array.isArray(courses.json) && courses.json.length === 10, `len=${courses.json?.length}`);
  check('all listed courses are published', courses.json.every((c) => c.status === 'published'));
  check('course has nested sections/lectures + instructor', courses.json[0].sections?.[0]?.lectures?.length >= 1 && courses.json[0].instructor?.name);

  const filtered = await req('GET', '/courses?category=Mergers%20%26%20Acquisitions');
  check('GET /courses filter category (M&A)', filtered.json.length >= 1 && filtered.json.every((c) => c.category === 'Mergers & Acquisitions'));

  const featured = await req('GET', '/courses/featured');
  check('GET /courses/featured', Array.isArray(featured.json) && featured.json.every((c) => c.featured && c.status === 'published'));

  const detail = await req('GET', '/courses/c001', { token: userToken });
  check('GET /courses/:id', detail.status === 200 && detail.json.id === 'c001' && detail.json.price === 35000);

  // Enroll free
  const enroll = await req('POST', '/enrollments', { token: userToken, body: { courseId: 'cfree' } });
  check('enroll free course', enroll.status === 201 && enroll.json.success);
  const paidEnroll = await req('POST', '/enrollments', { token: userToken, body: { courseId: 'c001' } });
  check('paid course enroll blocked', paidEnroll.status === 400 && paidEnroll.json.error.code === 'payment_required');

  const myEnroll = await req('GET', '/enrollments/me', { token: userToken });
  check('my enrollments shape', myEnroll.json.length === 1 && myEnroll.json[0].progress && myEnroll.json[0].enrolledAt && myEnroll.json[0].id === 'cfree');

  const prog = await req('POST', '/progress/complete', { token: userToken, body: { courseId: 'cfree', lectureId: 'l1' } });
  check('progress complete -> 100%', prog.status === 200 && prog.json.percentage === 100);

  const cert = await req('POST', '/certificates/generate', { token: userToken, body: { courseId: 'cfree' } });
  check('certificate generated with code+pdf', cert.status === 201 && /^FE-CFREE-/.test(cert.json.code) && cert.json.pdfUrl);

  const review = await req('POST', '/courses/cfree/reviews', { token: userToken, body: { rating: 5, comment: 'Great!' } });
  check('create review (enrolled)', review.status === 201 && review.json.rating === 5);

  // Payment flow (mock) for paid course c001 (₦35,000)
  const payInit = await req('POST', '/payments/initialize', { token: userToken, body: { items: ['c001'], paymentMethod: 'card', billing: { firstName: 'Sam', lastName: 'Test', email: 'sam@test.com', country: 'Nigeria' } } });
  check('payment initialize (₦35,000)', payInit.status === 201 && payInit.json.reference && payInit.json.total === 35000, JSON.stringify(payInit.json));
  const payVerify = await req('POST', '/payments/verify', { token: userToken, body: { reference: payInit.json.reference } });
  check('payment verify enrolls', payVerify.status === 200 && payVerify.json.success);
  const checkEnroll = await req('GET', '/enrollments/check?courseId=c001', { token: userToken });
  check('paid course now enrolled', checkEnroll.json.enrolled === true);

  // Jobs — public list returns only approved+active (5 seeded)
  const jobs = await req('GET', '/jobs', { token: userToken });
  check('GET /jobs array (approved+active)', Array.isArray(jobs.json) && jobs.json.length === 5);
  const internships = await req('GET', '/jobs/internships', { token: userToken });
  check('internships filter', internships.json.every((j) => j.type === 'Internship'));
  const jobDetail = await req('GET', '/jobs/j001', { token: userToken });
  check('job detail increments views', jobDetail.json.views === 1 && jobDetail.json.category === 'Legal');

  const apply = await req('POST', '/applications', { token: userToken, body: { jobId: 'j001', fullName: 'Sam Test', email: 'sam@test.com', coverLetter: 'I am great', experience: '3-5 years' } });
  check('apply to job', apply.status === 201 && apply.json.status === 'pending');
  const dupApply = await req('POST', '/applications', { token: userToken, body: { jobId: 'j001', fullName: 'Sam Test', email: 'sam@test.com', coverLetter: 'again' } });
  check('duplicate apply blocked', dupApply.status === 409 && dupApply.json.error.message === 'You have already applied for this job');
  const myApps = await req('GET', '/applications/me', { token: userToken });
  check('my applications include nested job', myApps.json.length === 1 && myApps.json[0].job?.id === 'j001');
  const appId = apply.json.id;

  // ── Employer/admin candidate review (j001 was seeded with postedBy = admin) ──
  const postedByMe = await req('GET', '/applications/posted-by-me', { token: adminToken });
  check('posted-by-me lists applicants for my jobs', postedByMe.json.some((a) => a.id === appId && a.job?.id === 'j001'));
  const applicantOnly = await req('GET', '/applications/posted-by-me', { token: userToken });
  check('posted-by-me empty for non-poster', Array.isArray(applicantOnly.json) && applicantOnly.json.length === 0);
  const reviewForbidden = await req('GET', '/applications/job/j001', { token: userToken });
  check('candidate cannot read a job\'s applicants', reviewForbidden.status === 403);
  const setStatus = await req('PATCH', `/applications/${appId}/status`, { token: adminToken, body: { status: 'shortlisted' } });
  check('employer/admin updates status + reviewedAt', setStatus.status === 200 && setStatus.json.status === 'shortlisted' && setStatus.json.reviewedAt);
  const myAppsAfter = await req('GET', '/applications/me', { token: userToken });
  check('candidate sees updated status', myAppsAfter.json[0].status === 'shortlisted');

  // ── Moderation: instructor course submission ──
  const becomeInst = await req('POST', '/auth/become-instructor', { token: userToken, body: { title: 'Counsel', experience: '3-5 years' } });
  check('become instructor', becomeInst.status === 200 && becomeInst.json.user.role === 'instructor');

  const createCourse = await req('POST', '/courses', { token: userToken, body: { title: 'New Tax Strategies', subtitle: 'Sub', description: 'Desc', category: 'Taxation', price: 199, sections: [{ id: 's1', title: 'Intro', lectures: [{ id: 'l1', title: 'Welcome' }] }] } });
  check('instructor create course -> pending (not public)', createCourse.status === 201 && createCourse.json.status === 'pending' && createCourse.json.submittedAt && createCourse.json.featured === false, JSON.stringify(createCourse.json?.error || createCourse.json?.status));
  const newCourseId = createCourse.json.id;

  const publicBeforeApprove = await req('GET', '/courses');
  check('pending course NOT in public list', !publicBeforeApprove.json.some((c) => c.id === newCourseId));

  // Admin sees it in admin list (status filter)
  const adminPending = await req('GET', '/admin/courses?status=pending', { token: adminToken });
  check('admin lists pending course', adminPending.json.some((c) => c.id === newCourseId));

  // Reject then approve
  const reject = await req('POST', `/admin/courses/${newCourseId}/reject`, { token: adminToken, body: { reason: 'Add more lectures' } });
  check('admin reject course', reject.status === 200 && reject.json.status === 'rejected' && reject.json.rejectionReason === 'Add more lectures');
  const approve = await req('POST', `/admin/courses/${newCourseId}/approve`, { token: adminToken });
  check('admin approve course -> published', approve.status === 200 && approve.json.status === 'published' && approve.json.rejectionReason === '');
  const publicAfterApprove = await req('GET', '/courses');
  check('approved course now in public list', publicAfterApprove.json.some((c) => c.id === newCourseId));

  // Admin pricing edit with validation (free forces 0)
  const priceEdit = await req('PATCH', `/admin/courses/${newCourseId}`, { token: adminToken, body: { isPaid: false, price: 50, originalPrice: 80 } });
  check('admin pricing edit: free forces price 0', priceEdit.status === 200 && priceEdit.json.price === 0 && priceEdit.json.originalPrice === 0);
  const priceEdit2 = await req('PATCH', `/admin/courses/${newCourseId}`, { token: adminToken, body: { isPaid: true, price: 100, originalPrice: 60 } });
  check('admin pricing edit: originalPrice clamped >= price', priceEdit2.json.price === 100 && priceEdit2.json.originalPrice === 100);

  // ── Jobs: admin-only posting, goes live immediately (no approval step) ──
  const nonAdminPost = await req('POST', '/jobs', { token: userToken, body: { title: 'Associate', company: 'Test LP', category: 'Legal', description: 'Join us', deadline: '2026-12-31' } });
  check('non-admin cannot post a job -> 403', nonAdminPost.status === 403);

  const postJob = await req('POST', '/jobs', { token: adminToken, body: { title: 'Associate', company: 'Test LP', category: 'Legal', description: 'Join us', deadline: '2026-12-31' } });
  check('admin posts job -> approved + active immediately', postJob.status === 201 && postJob.json.status === 'approved' && postJob.json.isActive === true);
  const newJobId = postJob.json.id;
  const jobsAfter = await req('GET', '/jobs', { token: userToken });
  check('posted job appears in public list immediately', jobsAfter.json.some((j) => j.id === newJobId));
  const salaryEdit = await req('PATCH', `/admin/jobs/${newJobId}`, { token: adminToken, body: { salary: { min: 500000, max: 100000, currency: 'NGN', period: 'monthly' } } });
  check('admin salary edit: max clamped >= min', salaryEdit.json.salary.min === 500000 && salaryEdit.json.salary.max === 500000);

  // Admin full-edit of the job (status preserved).
  const ownerEdit = await req('PATCH', `/jobs/${newJobId}`, {
    token: adminToken,
    body: { title: 'Senior Associate', description: 'Updated role', skills: ['Litigation', 'Drafting'], deadline: '2027-01-31', salary: { min: 600000, max: 900000, currency: 'NGN', period: 'monthly' } },
  });
  check('admin full-edits job, status preserved', ownerEdit.status === 200 && ownerEdit.json.title === 'Senior Associate' && ownerEdit.json.skills.includes('Litigation') && ownerEdit.json.salary.max === 900000 && ownerEdit.json.status === 'approved');
  const notOwnerEdit = await req('PATCH', '/jobs/j001', { token: userToken, body: { title: 'Hijack' } });
  check('non-owner cannot edit a job', notOwnerEdit.status === 403);

  // Admin "My Job Postings" — own jobs with applicant counts.
  const mine = await req('GET', '/jobs/mine', { token: adminToken });
  check('GET /jobs/mine returns my posted job', mine.json.some((j) => j.id === newJobId) && mine.json.every((j) => typeof j.applicantCount === 'number'));
  // admin posted the seeded jobs; j001 has 1 applicant (Sam), shortlisted earlier.
  const adminMine = await req('GET', '/jobs/mine', { token: adminToken });
  const j001Mine = adminMine.json.find((j) => j.id === 'j001');
  check('applicant counts on my jobs', j001Mine && j001Mine.applicantCount === 1 && j001Mine.shortlistedCount === 1);
  const adminJobsList = await req('GET', '/admin/jobs', { token: adminToken });
  check('admin jobs list carries applicantCount', adminJobsList.json.find((j) => j.id === 'j001')?.applicantCount === 1);

  // Contact
  const contact = await req('POST', '/contact', { body: { name: 'Lead', email: 'lead@test.com', message: 'Hi there' } });
  check('contact form', contact.status === 201 && contact.json.success);

  // Admin stats incl. moderation counts
  const stats = await req('GET', '/admin/stats', { token: adminToken });
  check('admin stats shape + pending counts', stats.status === 200 && stats.json.totalUsers >= 3 && 'pendingApprovals' in stats.json && 'pendingCourses' in stats.json && stats.json.revenueByMonth.length === 12);
  check('admin stats revenue reflects paid order', stats.json.totalRevenue === 35000, `rev=${stats.json.totalRevenue}`);

  // Admin protection + error codes
  const forbidden = await req('GET', '/admin/stats', { token: userToken });
  check('non-admin -> 403 FORBIDDEN', forbidden.status === 403 && forbidden.json.error.code === 'FORBIDDEN');
  const unauth = await req('GET', '/admin/stats');
  check('no token -> 401 UNAUTHENTICATED', unauth.status === 401 && unauth.json.error.code === 'UNAUTHENTICATED');

  // Admin users + guard rails
  const adminUsers = await req('GET', '/admin/users?q=sam', { token: adminToken });
  check('admin search users', Array.isArray(adminUsers.json) && adminUsers.json.some((u) => u.email === 'sam@test.com'));
  const selfDemote = await req('PATCH', `/admin/users/${adminLogin.json.user.id}`, { token: adminToken, body: { role: 'participant' } });
  check('admin cannot self-demote', selfDemote.status === 403);

  // Admin payments shape (summary + transactions, paid->completed)
  const payments = await req('GET', '/admin/payments', { token: adminToken });
  check('admin payments {summary,transactions}', payments.status === 200 && payments.json.summary && Array.isArray(payments.json.transactions) && payments.json.transactions[0]?.status === 'completed' && payments.json.summary.totalRevenue === 35000);

  // CSV export
  const csv = await req('GET', '/admin/payments/export', { token: adminToken });
  check('admin payments CSV export', csv.status === 200 && typeof csv.text === 'string' && csv.text.includes('Transaction ID'));

  // Admin refund revokes enrollment
  const orderId = payments.json.transactions[0].orderId;
  const refund = await req('PATCH', `/admin/payments/${orderId}`, { token: adminToken, body: { status: 'refunded' } });
  check('admin refund order', refund.status === 200 && refund.json.status === 'refunded');
  const afterRefund = await req('GET', '/enrollments/check?courseId=c001', { token: userToken });
  check('refund revoked enrollment', afterRefund.json.enrolled === false);

  // Admin analytics shape
  const analytics = await req('GET', '/admin/analytics', { token: adminToken });
  check('admin analytics shape', analytics.status === 200 && analytics.json.keyMetrics && Array.isArray(analytics.json.enrollmentTrend) && analytics.json.enrollmentTrend.length === 12 && Array.isArray(analytics.json.funnel));

  // Password reset flow
  const forgot = await req('POST', '/auth/forgot-password', { body: { email: 'sam@test.com' } });
  check('forgot-password neutral success', forgot.status === 200 && forgot.json.success);
  const forgotUnknown = await req('POST', '/auth/forgot-password', { body: { email: 'nobody@nowhere.com' } });
  check('forgot-password neutral for unknown email', forgotUnknown.status === 200 && forgotUnknown.json.success);

  // Validation
  const badReg = await req('POST', '/auth/register', { body: { email: 'x' } });
  check('validation error -> 400 VALIDATION', badReg.status === 400 && badReg.json.error.code === 'VALIDATION');

} catch (e) {
  fail++;
  results.push(`  ✗ EXCEPTION: ${e.stack || e.message}`);
} finally {
  console.log('\n' + results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed\n`);
  server.close();
  await disconnectDB();
  await mongod.stop();
  process.exit(fail ? 1 : 0);
}

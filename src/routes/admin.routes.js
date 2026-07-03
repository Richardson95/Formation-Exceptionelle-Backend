import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import * as instructorCtrl from '../controllers/instructorApplicationController.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  userUpdateSchema,
  courseAdminPatchSchema,
  jobAdminPatchSchema,
  rejectSchema,
  paymentStatusSchema,
  usersQuerySchema,
} from '../validators/adminValidators.js';

const router = Router();

// All admin routes require an authenticated admin.
router.use(authRequired, adminOnly);

router.get('/stats', ctrl.stats);
router.get('/analytics', ctrl.analytics);

// Users
router.get('/users', validate({ query: usersQuerySchema }), ctrl.listUsers);
router.get('/users/:id', ctrl.getUser);
router.patch('/users/:id', validate({ body: userUpdateSchema }), ctrl.updateUser);
router.delete('/users/:id', ctrl.deleteUser);

// Courses
router.get('/courses', ctrl.listCourses);
router.post('/courses/:id/approve', ctrl.approveCourse);
router.post('/courses/:id/reject', validate({ body: rejectSchema }), ctrl.rejectCourse);
router.patch('/courses/:id', validate({ body: courseAdminPatchSchema }), ctrl.updateCourse);
router.delete('/courses/:id', ctrl.deleteCourse);

// Jobs
router.get('/jobs', ctrl.listJobs);
router.post('/jobs/:id/approve', ctrl.approveJob);
router.post('/jobs/:id/reject', validate({ body: rejectSchema }), ctrl.rejectJob);
router.patch('/jobs/:id', validate({ body: jobAdminPatchSchema }), ctrl.updateJob);
router.delete('/jobs/:id', ctrl.deleteJob);

// Instructor applications (become-an-instructor review queue)
router.get('/instructor-applications', instructorCtrl.listApplications);
router.patch('/instructor-applications/:id', instructorCtrl.reviewApplication);

// Payments
router.get('/payments', ctrl.listPayments);
router.get('/payments/export', ctrl.exportPayments);
router.patch('/payments/:id', validate({ body: paymentStatusSchema }), ctrl.updatePayment);

export default router;

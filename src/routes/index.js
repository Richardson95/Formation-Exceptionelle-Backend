import { Router } from 'express';

import authRoutes from './auth.routes.js';
import courseRoutes from './course.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import progressRoutes from './progress.routes.js';
import jobRoutes from './job.routes.js';
import applicationRoutes from './application.routes.js';
import instructorApplicationRoutes from './instructorApplication.routes.js';
import videoRoutes from './video.routes.js';
import paymentRoutes from './payment.routes.js';
import certificateRoutes from './certificate.routes.js';
import quizRoutes from './quiz.routes.js';
import adminRoutes from './admin.routes.js';
import uploadRoutes from './upload.routes.js';
import contactRoutes from './contact.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/progress', progressRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/instructor-applications', instructorApplicationRoutes);
router.use('/videos', videoRoutes);
router.use('/payments', paymentRoutes);
router.use('/certificates', certificateRoutes);
router.use('/quizzes', quizRoutes);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);
router.use('/contact', contactRoutes);

export default router;

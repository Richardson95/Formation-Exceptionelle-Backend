import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/enrollmentController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/',
  authRequired,
  validate({ body: z.object({ courseId: z.string().min(1) }) }),
  ctrl.enroll
);
router.get('/me', authRequired, ctrl.myEnrollments);
router.get('/check', authRequired, ctrl.checkEnrollment);

export default router;

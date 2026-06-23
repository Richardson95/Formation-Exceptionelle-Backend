import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/progressController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', authRequired, ctrl.getProgress);
router.post(
  '/complete',
  authRequired,
  validate({ body: z.object({ courseId: z.string().min(1), lectureId: z.string().min(1) }) }),
  ctrl.completeLecture
);

export default router;

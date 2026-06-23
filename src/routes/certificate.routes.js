import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/certificateController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/generate',
  authRequired,
  validate({ body: z.object({ courseId: z.string().min(1) }) }),
  ctrl.generate
);
router.get('/me', authRequired, ctrl.myCertificates);
router.get('/:id', ctrl.getCertificate); // public verification

export default router;
